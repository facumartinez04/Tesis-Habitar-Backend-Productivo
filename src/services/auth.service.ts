import { userRepository } from '../repositories/user.repository';
import { institutionRepository } from '../repositories/institution.repository';
import { revokedTokenRepository } from '../repositories/revokedToken.repository';
import { signToken } from '../utils/jwt';
import { ForbiddenError, UnauthorizedError } from '../utils/http-error';
import { getProviderConfig, getRedirectUri, loadClient } from './oidc-providers';
import { env } from '../config/env';
import type { OAuthProviderId, Role } from '../domain/enums';
import type { Session } from '../domain/auth';
import type { Institution } from '../domain/institution';

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
  getSessionUser(userId: string): Promise<Session['user']>;
  buildAuthorizationRequest(provider: OAuthProviderId): Promise<OAuthAuthorizationRequest>;
  handleOAuthCallback(input: HandleOAuthCallbackInput): Promise<Session>;
  logout(jti: string, userId: string, expiresAtEpochSeconds: number): Promise<void>;
}

function emailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

/**
 * Rol de un usuario que entra por primera vez. Antes dependía del proveedor
 * elegido (Microsoft daba coordinador), así que cualquier cuenta del dominio
 * podía darse permisos de coordinación. Ahora sólo es coordinador el correo
 * cargado como coordinador al dar de alta la institución; el resto entra como
 * docente, sin importar el proveedor, y la coordinación ajusta el rol después.
 */
function initialRoleFor(email: string, institution: Institution, isSuperAdmin: boolean): Role {
  if (isSuperAdmin) return 'ADMIN';
  if (institution.coordinatorEmail && institution.coordinatorEmail.toLowerCase() === email.toLowerCase()) {
    return 'COORDINADOR';
  }
  return 'DOCENTE';
}

export class DefaultAuthService implements AuthService {
  async getSessionUser(userId: string): Promise<Session['user']> {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError('Usuario no encontrado');
    return user;
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
      // Sin la URL completa: lleva el código de autorización y el state.
      console.error('[auth] falló authorizationCodeGrant', {
        provider: input.provider,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new UnauthorizedError('No se pudo validar la respuesta del proveedor de login');
    }

    const claims = tokens.claims();
    const email = claims?.email as string | undefined;
    if (!email) throw new UnauthorizedError('La cuenta no expone un email verificado');

    // Una cuenta ya dada de alta (por la administración o por la coordinación) entra a su institución
    // aunque su correo no sea del dominio institucional, por ejemplo un Gmail: el usuario guardado es la
    // fuente de verdad. El alta automática por dominio queda sólo para cuentas nuevas, y SUPER_ADMIN_EMAILS
    // sólo sirve para dar de alta al primer administrador.
    const existing = await userRepository.findByEmail(email);
    if (existing && !existing.active) {
      throw new ForbiddenError('Tu cuenta fue desactivada. Contactá a tu coordinador/a.');
    }
    const isSuperAdmin = !existing && env.superAdminEmails.includes(email.toLowerCase());
    const institution = existing
      ? await institutionRepository.findById(existing.institutionId)
      : isSuperAdmin
        ? await this.getOrCreateSuperAdminInstitution(email)
        : await institutionRepository.findByDomain(emailDomain(email));
    if (!institution || institution.status !== 'ACTIVO') {
      throw new ForbiddenError('Tu institución no está habilitada en Habitar. Contactá a tu coordinador/a.');
    }

    let user = existing;
    if (!user) {
      const name = (claims?.name as string | undefined) ?? email;
      user = await userRepository.create({
        name,
        email,
        role: initialRoleFor(email, institution, isSuperAdmin),
        provider: input.provider,
        institutionId: institution.id,
      });
    }

    const token = signToken({ sub: user.id, role: user.role, institutionId: user.institutionId, provider: user.provider });
    return { token, user };
  }

  async logout(jti: string, userId: string, expiresAtEpochSeconds: number): Promise<void> {
    await revokedTokenRepository.revoke(jti, userId, new Date(expiresAtEpochSeconds * 1000));
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
  // El director ve el panel institucional, igual que la coordinación.
  if (role === 'COORDINADOR' || role === 'DIRECTOR') return '/institucional';
  return '/docente/cursos';
}
