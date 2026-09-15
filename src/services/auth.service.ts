import { userRepository } from '../repositories/user.repository';
import { institutionRepository } from '../repositories/institution.repository';
import { signToken } from '../utils/jwt';
import { ForbiddenError, UnauthorizedError } from '../utils/http-error';
import { getProviderConfig, getRedirectUri, loadClient } from './oidc-providers';
import { env } from '../config/env';
import type { OAuthProviderId, Role } from '../domain/enums';
import type { Session } from '../domain/auth';
import type { Institution } from '../domain/institution';

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

  async handleOAuthCallback(input: HandleOAuthCallbackInput): Promise<Session> {
    const client = await loadClient();
    const config = await getProviderConfig(input.provider);

    let tokens;
    try {
      tokens = await client.authorizationCodeGrant(config, input.callbackUrl, {
        pkceCodeVerifier: input.codeVerifier,
        expectedState: input.expectedState,
      });
    } catch (err) {

      console.error('[auth] falló authorizationCodeGrant', {
        provider: input.provider,
        derivedRedirectUri: `${input.callbackUrl.origin}${input.callbackUrl.pathname}`,
        configuredRedirectUri: getRedirectUri(input.provider),
        error: err,
      });
      throw new UnauthorizedError('No se pudo validar la respuesta del proveedor de login');
    }

    const claims = tokens.claims();
    const email = claims?.email as string | undefined;
    if (!email) throw new UnauthorizedError('La cuenta no expone un email verificado');

    const isSuperAdmin = env.superAdminEmails.includes(email.toLowerCase());
    const institution = isSuperAdmin
      ? await this.getOrCreateSuperAdminInstitution(email)
      : await institutionRepository.findByDomain(emailDomain(email));
    if (!institution || institution.status !== 'ACTIVO') {
      throw new ForbiddenError('Tu institución no está habilitada en Habitar. Contactá a tu coordinador/a.');
    }

    let user = await userRepository.findByEmail(email);
    if (!user) {
      const name = (claims?.name as string | undefined) ?? email;
      user = await userRepository.create({
        name,
        email,
        role: isSuperAdmin ? 'ADMIN' : providerDefaultRole[input.provider],
        provider: input.provider,
        institutionId: institution.id,
      });
    } else if (!user.active) {
      throw new ForbiddenError('Tu cuenta fue desactivada. Contactá a tu coordinador/a.');
    } else if (user.institutionId !== institution.id) {

      throw new ForbiddenError('El email no corresponde a la institución registrada.');
    }

    const token = signToken({ sub: user.id, role: user.role, institutionId: user.institutionId, provider: user.provider });
    return { token, user };
  }

  private async getOrCreateSuperAdminInstitution(email: string): Promise<Institution> {
    const existing = await institutionRepository.findBySlug('habitar-admin');
    if (existing) return existing;
    return institutionRepository.create({
      name: 'Habitar Admin',
      domain: 'habitar-admin.internal',
      status: 'ACTIVO',
      coordinatorEmail: email,
      levels: ['PRIMARIO', 'SECUNDARIO'],
    });
  }
}

export const authService = new DefaultAuthService();

export function dashboardPathForRole(role: Role): string {
  if (role === 'ADMIN') return '/admin/instituciones/nueva';
  if (role === 'COORDINADOR') return '/institucional';
  return '/docente/cursos';
}
