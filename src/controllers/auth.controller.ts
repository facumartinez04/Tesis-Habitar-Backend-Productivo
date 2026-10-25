import type { Request, Response } from 'express';
import { authService, dashboardPathForRole } from '../bll/auth.service';
import { env } from '../config/env';
import { getRedirectUri } from '../services/oidc-providers';
import { BadRequestError, UnauthorizedError } from '../utils/http-error';
import type { OAuthProviderId } from '../domain/enums';
import { logService } from '../bll/log.service';
import type { UpdateLanguageDto } from '../dto/auth.dto';
import { refreshSessionService } from '../bll/refresh-session.service';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '../utils/refresh-cookie';
import { ForbiddenError } from '../utils/http-error';

const isProd = process.env.NODE_ENV === 'production';

function oauthCookieName(provider: string): string {
  return `habitar_oauth_${provider.toLowerCase()}`;
}

function assertProvider(value: string): asserts value is OAuthProviderId {
  if (value !== 'GOOGLE' && value !== 'MICROSOFT') throw new BadRequestError(`Proveedor no soportado: ${value}`);
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
    const institutionLanguage = await authService.getInstitutionLanguage(user.institutionId);
    res.json({ user, institutionLanguage });
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
      const institutionLanguage = await authService.getInstitutionLanguage(result.user.institutionId);
      res.json({ token: result.token, user: result.user, institutionLanguage });
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

    try {
      const session = await authService.handleOAuthCallback({
        provider: providerParam,
        callbackUrl,
        expectedState: state,
        codeVerifier,
      });

      void logService.event({
        actor: { userId: session.user.id, role: session.user.role, institutionId: session.user.institutionId, impersonated: false, userName: session.user.name, userEmail: session.user.email },
        institutionId: session.user.institutionId,
        category: 'ACCESO',
        type: 'LOGIN',
        description: `Inició sesión con ${providerParam === 'GOOGLE' ? 'Google' : 'Microsoft'}.`,
      });

      setRefreshCookie(res, await refreshSessionService.issue(session.user.id, req.header('user-agent') ?? null));

      const redirectTo = new URL('/auth/callback', env.frontendUrl);
      redirectTo.hash = new URLSearchParams({
        token: session.token,
        dashboardPath: dashboardPathForRole(session.user.role),
      }).toString();
      res.redirect(redirectTo.toString());
    } catch (err) {
      let errorCode = 'auth_failed';
      if (err instanceof Error) {
        if (err.message.includes('habilitada')) errorCode = 'institution_not_allowed';
        else if (err.message.includes('desactivada')) errorCode = 'account_disabled';
        else if (err.message.includes('institución registrada')) errorCode = 'invalid_tenant';
        else if (err.message.includes('expiró')) errorCode = 'session_expired';
        else if (err.message.includes('proveedor')) errorCode = 'unauthorized';
      }
      const tag = (err ?? {}) as { loginEmail?: string; loginUserId?: string | null; loginInstitutionId?: string | null };
      void logService.event({
        actor: { userId: tag.loginUserId ?? null, role: null, institutionId: tag.loginInstitutionId ?? null, impersonated: false, userEmail: tag.loginEmail ?? null },
        institutionId: tag.loginInstitutionId ?? null,
        category: 'ACCESO',
        type: 'LOGIN_FALLIDO',
        description: `Inicio de sesión rechazado con ${providerParam === 'GOOGLE' ? 'Google' : 'Microsoft'} (${errorCode}).`,
      });
      const redirectTo = new URL('/login', env.frontendUrl);
      redirectTo.searchParams.set('error', errorCode);
      res.redirect(redirectTo.toString());
    }
  }
}

export const authController = new AuthController();
