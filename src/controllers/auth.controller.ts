import type { Request, Response } from 'express';
import { authService, dashboardPathForRole } from '../bll/auth.service';
import { env } from '../config/env';
import { getRedirectUri } from '../services/oidc-providers';
import { BadRequestError, UnauthorizedError } from '../utils/http-error';
import type { OAuthProviderId } from '../domain/enums';

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
    res.json({ user });
  }

  async logout(req: Request, res: Response): Promise<void> {
    const { jti, exp, sub } = req.auth!;
    if (jti && exp) await authService.logout(jti, sub, exp);
    res.status(204).send();
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
      const redirectTo = new URL('/login', env.frontendUrl);
      redirectTo.searchParams.set('error', errorCode);
      res.redirect(redirectTo.toString());
    }
  }
}

export const authController = new AuthController();
