import { userRepository } from '../repositories/user.repository';
import { institutionRepository } from '../repositories/institution.repository';
import { signToken } from '../utils/jwt';
import { ForbiddenError, UnauthorizedError } from '../utils/http-error';
import { getProviderConfig, getRedirectUri, loadClient } from './oidc-providers';
import type { OAuthProviderId, Role } from '../domain/enums';
import type { Session } from '../domain/auth';

const providerDefaultRole: Record<OAuthProviderId, Role> = {
  GOOGLE: 'DOCENTE',
  MICROSOFT: 'COORDINADOR',
};

export interface OAuthAuthorizationRequest {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
}

export interface HandleOAuthCallbackInput {
  provider: OAuthProviderId;
  /** URL completa del callback, con la query string que mandó el proveedor (code, state, etc). */
  callbackUrl: URL;
  expectedState: string;
  codeVerifier: string;
}

export interface AuthService {
  loginWithProvider(provider: OAuthProviderId): Promise<Session>;
  getSessionUser(userId: string): Promise<Session['user']>;
  createAdminSession(): Promise<Session>;
  buildAuthorizationRequest(provider: OAuthProviderId): Promise<OAuthAuthorizationRequest>;
  handleOAuthCallback(input: HandleOAuthCallbackInput): Promise<Session>;
}

function emailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

export class DefaultAuthService implements AuthService {
  /** Login simulado (sin credenciales reales) — se mantiene para desarrollo/demo local. */
  async loginWithProvider(provider: OAuthProviderId): Promise<Session> {
    const role = providerDefaultRole[provider];
    const user = await userRepository.findFirstByProviderAndRole(provider, role);
    if (!user) throw new UnauthorizedError('No existe un usuario para este proveedor');

    const token = signToken({ sub: user.id, role: user.role, institutionId: user.institutionId, provider: user.provider });
    return { token, user };
  }

  async getSessionUser(userId: string): Promise<Session['user']> {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError('Usuario no encontrado');
    return user;
  }

  async createAdminSession(): Promise<Session> {
    const user = await userRepository.findFirstByRole('ADMIN');
    if (!user) throw new UnauthorizedError('No existe un usuario administrador configurado');

    const token = signToken({ sub: user.id, role: user.role, institutionId: user.institutionId, provider: user.provider });
    return { token, user };
  }

  /** CU-01-01: arma la Authorization URL (Authorization Code + PKCE) para redirigir al usuario. */
  async buildAuthorizationRequest(provider: OAuthProviderId): Promise<OAuthAuthorizationRequest> {
    const client = await loadClient();
    const config = await getProviderConfig(provider);
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();

    const authorizationUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: getRedirectUri(provider),
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return { authorizationUrl: authorizationUrl.href, state, codeVerifier };
  }

  /**
   * CU-01-01: intercambia el code por tokens, valida el id_token, resuelve la institución
   * por el dominio del email y busca/crea el usuario. Devuelve una sesión igual a la del login simulado.
   */
  async handleOAuthCallback(input: HandleOAuthCallbackInput): Promise<Session> {
    const client = await loadClient();
    const config = await getProviderConfig(input.provider);

    let tokens;
    try {
      tokens = await client.authorizationCodeGrant(config, input.callbackUrl, {
        pkceCodeVerifier: input.codeVerifier,
        expectedState: input.expectedState,
      });
    } catch {
      throw new UnauthorizedError('No se pudo validar la respuesta del proveedor de login');
    }

    const claims = tokens.claims();
    const email = claims?.email as string | undefined;
    if (!email) throw new UnauthorizedError('La cuenta no expone un email verificado');

    const domain = emailDomain(email);
    const institution = await institutionRepository.findByDomain(domain);
    if (!institution || institution.status !== 'ACTIVO') {
      throw new ForbiddenError('Tu institución no está habilitada en Habitar. Contactá a tu coordinador/a.');
    }

    let user = await userRepository.findByEmail(email);
    if (!user) {
      const name = (claims?.name as string | undefined) ?? email;
      user = await userRepository.create({
        name,
        email,
        role: providerDefaultRole[input.provider],
        provider: input.provider,
        institutionId: institution.id,
      });
    } else if (!user.active) {
      throw new ForbiddenError('Tu cuenta fue desactivada. Contactá a tu coordinador/a.');
    } else if (user.institutionId !== institution.id) {
      // El email cambió de institución (dominio distinto al que tiene registrado) — no debería pasar,
      // pero por las dudas no dejamos cruzar la sesión a un tenant que no le corresponde.
      throw new ForbiddenError('El email no corresponde a la institución registrada.');
    }

    const token = signToken({ sub: user.id, role: user.role, institutionId: user.institutionId, provider: user.provider });
    return { token, user };
  }
}

export const authService = new DefaultAuthService();

export function dashboardPathForRole(role: Role): string {
  if (role === 'ADMIN') return '/admin/instituciones/nueva';
  if (role === 'COORDINADOR') return '/institucional';
  return '/docente/cursos';
}
