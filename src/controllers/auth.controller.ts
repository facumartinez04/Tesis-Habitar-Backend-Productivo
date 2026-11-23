import type { Request, Response } from 'express';
import { authService, dashboardPathForRole, type LoginIdentity } from '../bll/auth.service';
import { PENDING_LOGIN_DAYS, signPendingLogin, verifyPendingLogin } from '../bll/pending-login';
import type { Session } from '../domain/auth';
import { env } from '../config/env';
import { getRedirectUri } from '../services/oidc-providers';
import { BadRequestError, UnauthorizedError } from '../utils/http-error';
import type { OAuthProviderId } from '../domain/enums';
import { logService } from '../bll/log.service';
import type { UpdateLanguageDto } from '../dto/auth.dto';
import { refreshSessionService } from '../bll/refresh-session.service';
import {
  clearPendingLoginCookie,
  clearRefreshCookie,
  readPendingLoginCookie,
  readRefreshCookie,
  setPendingLoginCookie,
  setRefreshCookie,
} from '../utils/refresh-cookie';
import { ForbiddenError } from '../utils/http-error';

const isProd = process.env.NODE_ENV === 'production';

function oauthCookieName(provider: string): string {
  return `habitar_oauth_${provider.toLowerCase()}`;
}

function assertProvider(value: string): asserts value is OAuthProviderId {
  if (value !== 'GOOGLE' && value !== 'MICROSOFT') throw new BadRequestError(`Proveedor no soportado: ${value}`);
}

function providerLabel(provider: OAuthProviderId): string {
  return provider === 'GOOGLE' ? 'Google' : 'Microsoft';
}

function loginErrorCode(err: unknown): string {
  if (!(err instanceof Error)) return 'auth_failed';
  if (err.message.includes('habilitada')) return 'institution_not_allowed';
  if (err.message.includes('desactivada')) return 'account_disabled';
  if (err.message.includes('institución registrada')) return 'invalid_tenant';
  if (err.message.includes('invitadas')) return 'guest_account';
  if (err.message.includes('expiró')) return 'session_expired';
  if (err.message.includes('proveedor')) return 'unauthorized';
  return 'auth_failed';
}

/** Solo se recuerda la identidad cuando el proveedor la verificó y lo único que falta es el alta en Habitar. */
const PENDING_CODES = new Set(['institution_not_allowed', 'account_disabled']);

function logRejectedLogin(provider: OAuthProviderId, err: unknown, errorCode: string, extra = ''): void {
  const tag = (err ?? {}) as { loginEmail?: string | null; loginUserId?: string | null; loginInstitutionId?: string | null; loginTenantId?: string | null };
  // El tenant de Microsoft queda en la bitácora para que el administrador pueda copiarlo al configurar la institución.
  const tenantNote = tag.loginTenantId ? `; organización de Microsoft ${tag.loginTenantId}` : '';
  void logService.event({
    actor: { userId: tag.loginUserId ?? null, role: null, institutionId: tag.loginInstitutionId ?? null, impersonated: false, userEmail: tag.loginEmail ?? null },
    institutionId: tag.loginInstitutionId ?? null,
    category: 'ACCESO',
    type: 'LOGIN_FALLIDO',
    description: `Inicio de sesión rechazado con ${providerLabel(provider)}${extra} (${errorCode}${tenantNote}).`,
  });
}

export class AuthController {
  integrations(_req: Request, res: Response): void {
    const google = env.oauth.google;
    const microsoft = env.oauth.microsoft;
    const appId = google.clientId.split('-')[0];
    res.json({
      googleDrive: google.clientId ? { clientId: google.clientId, apiKey: google.pickerApiKey, appId } : null,
      oneDrive: microsoft.clientId ? { clientId: microsoft.clientId, tenantId: microsoft.tenantId || 'common' } : null,
    });
  }

  async me(req: Request, res: Response): Promise<void> {
    const user = await authService.getSessionUser(req.auth!.sub);
    const settings = await authService.getInstitutionSettings(user.institutionId);
    res.json({ user, ...settings });
  }

  async updateLanguage(req: Request, res: Response): Promise<void> {
    const { language } = req.body as UpdateLanguageDto;
    const user = await authService.updateLanguage(req.auth!.sub, language);
    res.json({ user });
  }

  async logout(req: Request, res: Response): Promise<void> {
    if (req.auth) {
      const { jti, exp, sub } = req.auth;
      if (jti && exp) await authService.logout(jti, sub, exp);
    }
    await refreshSessionService.revoke(readRefreshCookie(req));
    clearRefreshCookie(res);
    res.status(204).send();
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const origin = req.header('origin')?.replace(/\/$/, '');
    if (origin && !env.corsOrigins.includes(origin)) throw new ForbiddenError('Origen no permitido');
    try {
      const result = await refreshSessionService.refresh(readRefreshCookie(req), req.header('user-agent') ?? null);
      if (result.refresh) setRefreshCookie(res, result.refresh);
      const settings = await authService.getInstitutionSettings(result.user.institutionId);
      res.json({ token: result.token, user: result.user, ...settings });
    } catch (err) {
      clearRefreshCookie(res);
      throw err;
    }
  }

  async redirectToProvider(req: Request, res: Response): Promise<void> {
    const providerParam = String(req.params.provider).toUpperCase();
    assertProvider(providerParam);

    const { authorizationUrl, state, codeVerifier } = await authService.buildAuthorizationRequest(providerParam);

    res.cookie(oauthCookieName(providerParam), JSON.stringify({ state, codeVerifier }), {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });

    res.redirect(authorizationUrl);
  }

  async handleOAuthCallback(req: Request, res: Response): Promise<void> {
    const providerParam = String(req.params.provider).toUpperCase();
    assertProvider(providerParam);

    const cookieName = oauthCookieName(providerParam);
    const raw = req.cookies?.[cookieName];
    res.clearCookie(cookieName);
    if (!raw) throw new UnauthorizedError('La sesión de login expiró, intentá de nuevo');

    const { state, codeVerifier } = JSON.parse(raw) as { state: string; codeVerifier: string };

    const queryIndex = req.originalUrl.indexOf('?');
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
    const callbackUrl = new URL(getRedirectUri(providerParam) + query);

    let identity: LoginIdentity | null = null;
    try {
      identity = await authService.identityFromCallback({ provider: providerParam, callbackUrl, expectedState: state, codeVerifier });
      const session = await authService.sessionForIdentity(identity);
      await this.startSession(req, res, session, `Inició sesión con ${providerLabel(providerParam)}.`);

      const redirectTo = new URL('/auth/callback', env.frontendUrl);
      redirectTo.hash = new URLSearchParams({
        token: session.token,
        dashboardPath: dashboardPathForRole(session.user.role),
      }).toString();
      res.redirect(redirectTo.toString());
    } catch (err) {
      const errorCode = loginErrorCode(err);
      logRejectedLogin(providerParam, err, errorCode);
      if (identity && PENDING_CODES.has(errorCode)) {
        setPendingLoginCookie(res, signPendingLogin(identity), PENDING_LOGIN_DAYS);
      } else {
        clearPendingLoginCookie(res);
      }
      const redirectTo = new URL('/login', env.frontendUrl);
      redirectTo.searchParams.set('error', errorCode);
      res.redirect(redirectTo.toString());
    }
  }

  /** Ingreso pendiente: quién se identificó y todavía no puede entrar (204 si no hay ninguno). */
  getPendingLogin(req: Request, res: Response): void {
    const raw = readPendingLoginCookie(req);
    const identity = verifyPendingLogin(raw);
    if (!identity) {
      if (raw) clearPendingLoginCookie(res);
      res.status(204).send();
      return;
    }
    res.json({ email: identity.email, name: identity.name, provider: identity.provider });
  }

  /** «Volver a validar»: reintenta el ingreso con la identidad guardada, sin pasar otra vez por el proveedor. */
  async retryPendingLogin(req: Request, res: Response): Promise<void> {
    const origin = req.header('origin')?.replace(/\/$/, '');
    if (origin && !env.corsOrigins.includes(origin)) throw new ForbiddenError('Origen no permitido');
    const identity = verifyPendingLogin(readPendingLoginCookie(req));
    if (!identity) {
      clearPendingLoginCookie(res);
      throw new UnauthorizedError('La sesión de login expiró, intentá de nuevo');
    }
    try {
      const session = await authService.sessionForIdentity(identity);
      await this.startSession(req, res, session, `Inició sesión con ${providerLabel(identity.provider)} (revalidación).`);
      res.json({ token: session.token, dashboardPath: dashboardPathForRole(session.user.role) });
    } catch (err) {
      const code = loginErrorCode(err);
      logRejectedLogin(identity.provider, err, code, ' (revalidación)');
      if (!PENDING_CODES.has(code)) clearPendingLoginCookie(res);
      res.status(403).json({ error: err instanceof Error ? err.message : 'No se pudo iniciar sesión', code });
    }
  }

  /** «Usar otra cuenta»: olvida el ingreso pendiente. */
  clearPendingLogin(_req: Request, res: Response): void {
    clearPendingLoginCookie(res);
    res.status(204).send();
  }

  private async startSession(req: Request, res: Response, session: Session, description: string): Promise<void> {
    void logService.event({
      actor: { userId: session.user.id, role: session.user.role, institutionId: session.user.institutionId, impersonated: false, userName: session.user.name, userEmail: session.user.email },
      institutionId: session.user.institutionId,
      category: 'ACCESO',
      type: 'LOGIN',
      description,
    });
    setRefreshCookie(res, await refreshSessionService.issue(session.user.id, req.header('user-agent') ?? null));
    clearPendingLoginCookie(res);
  }
}

export const authController = new AuthController();
