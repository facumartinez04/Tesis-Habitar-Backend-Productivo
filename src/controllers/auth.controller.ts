import type { Request, Response } from 'express';
import { authService, dashboardPathForRole } from '../services/auth.service';
import { env } from '../config/env';
import { getRedirectUri } from '../services/oidc-providers';
import { BadRequestError, UnauthorizedError } from '../utils/http-error';
import type { LoginDto } from '../dto/auth.dto';
import type { OAuthProviderId } from '../domain/enums';

const isProd = process.env.NODE_ENV === 'production';

function oauthCookieName(provider: string): string {
  return `habitar_oauth_${provider.toLowerCase()}`;
}

function assertProvider(value: string): asserts value is OAuthProviderId {
  if (value !== 'GOOGLE' && value !== 'MICROSOFT') throw new BadRequestError(`Proveedor no soportado: ${value}`);
}

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    const { provider } = req.body as LoginDto;
    const session = await authService.loginWithProvider(provider);
    res.json({ ...session, dashboardPath: dashboardPathForRole(session.user.role) });
  }

  async me(req: Request, res: Response): Promise<void> {
    const user = await authService.getSessionUser(req.auth!.sub);
    res.json({ user });
  }

  async adminSession(_req: Request, res: Response): Promise<void> {
    const session = await authService.createAdminSession();
    res.json({ ...session, dashboardPath: dashboardPathForRole(session.user.role) });
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
    console.log('[auth] callback recibido', {
      provider: providerParam,
      reqProtocol: req.protocol,
      reqHost: req.get('host'),
      callbackUrl: callbackUrl.toString(),
    });

    try {
      const session = await authService.handleOAuthCallback({
        provider: providerParam,
        callbackUrl,
        expectedState: state,
        codeVerifier,
      });

      const redirectTo = new URL('/auth/callback', env.frontendUrl);
      redirectTo.searchParams.set('token', session.token);
      redirectTo.searchParams.set('dashboardPath', dashboardPathForRole(session.user.role));
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
