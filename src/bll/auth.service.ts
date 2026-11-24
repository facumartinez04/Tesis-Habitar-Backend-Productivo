import { userRepository } from '../dal/user.repository';
import { DEFAULT_READING_MAX_CHARS, institutionRepository } from '../dal/institution.repository';
import { revokedTokenRepository } from '../dal/revokedToken.repository';
import { signToken } from '../utils/jwt';
import { ForbiddenError, UnauthorizedError } from '../utils/http-error';
import { getProviderConfig, getRedirectUri, loadClient } from '../services/oidc-providers';
import { env } from '../config/env';
import type { OAuthProviderId, Role } from '../domain/enums';
import type { Session } from '../domain/auth';
import type { Institution } from '../domain/institution';
import type { Locale } from '../i18n/locale';
import { getInstitutionPause, type InstitutionPause } from './institution-pause';
import { assertMicrosoftEmailTrusted, microsoftIdentityFromClaims, type MicrosoftIdentity } from './microsoft-identity';
import { selectMembership } from './membership';
import type { User } from '../domain/user';

export interface InstitutionChoice {
  id: string;
  name: string;
}

export class ChooseInstitutionError extends Error {
  constructor(public readonly choices: InstitutionChoice[]) {
    super('Elegí la institución a la que querés entrar');
    this.name = 'ChooseInstitutionError';
  }
}

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

export interface LoginIdentity {
  provider: OAuthProviderId;
  email: string;
  name: string | null;
  microsoft: MicrosoftIdentity | null;
}

export interface AuthService {
  getSessionUser(userId: string): Promise<Session['user']>;
  getInstitutionSettings(
    institutionId: string,
  ): Promise<{ institutionLanguage: Locale; readingMaxChars: number; institutionPaused: InstitutionPause | null }>;
  updateLanguage(userId: string, language: Locale | null): Promise<Session['user']>;
  buildAuthorizationRequest(provider: OAuthProviderId): Promise<OAuthAuthorizationRequest>;
  handleOAuthCallback(input: HandleOAuthCallbackInput): Promise<Session>;
  identityFromCallback(input: HandleOAuthCallbackInput): Promise<LoginIdentity>;
  sessionForIdentity(identity: LoginIdentity, chosenInstitutionId?: string): Promise<Session>;
  institutionChoices(identity: LoginIdentity): Promise<InstitutionChoice[]>;
  logout(jti: string, userId: string, expiresAtEpochSeconds: number): Promise<void>;
}

function emailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

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

  async getInstitutionSettings(
    institutionId: string,
  ): Promise<{ institutionLanguage: Locale; readingMaxChars: number; institutionPaused: InstitutionPause | null }> {
    const [institution, institutionPaused] = await Promise.all([
      institutionRepository.findById(institutionId),
      getInstitutionPause(institutionId),
    ]);
    return {
      institutionLanguage: institution?.defaultLanguage ?? 'es',
      readingMaxChars: institution?.readingMaxChars ?? DEFAULT_READING_MAX_CHARS,
      institutionPaused,
    };
  }

  async updateLanguage(userId: string, language: Locale | null): Promise<Session['user']> {
    return userRepository.updateLanguage(userId, language);
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
    return this.sessionForIdentity(await this.identityFromCallback(input));
  }

  async identityFromCallback(input: HandleOAuthCallbackInput): Promise<LoginIdentity> {
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
        error: err instanceof Error ? err.message : String(err),
      });
      throw new UnauthorizedError('No se pudo validar la respuesta del proveedor de login');
    }

    const claims = tokens.claims() as Record<string, unknown> | undefined;
    let email: string;
    let microsoft: MicrosoftIdentity | null = null;
    if (input.provider === 'MICROSOFT') {
      try {
        microsoft = microsoftIdentityFromClaims(claims);
        email = microsoft.email;
      } catch (err) {
        throw Object.assign(err as Error, {
          loginEmail: typeof claims?.preferred_username === 'string' ? claims.preferred_username : null,
          loginTenantId: typeof claims?.tid === 'string' ? claims.tid : null,
        });
      }
    } else {
      const claimed = claims?.email as string | undefined;
      if (!claimed) throw new UnauthorizedError('La cuenta no expone un email verificado');
      email = claimed;
    }
    const name = typeof claims?.name === 'string' && claims.name.trim() ? claims.name.trim() : null;
    return { provider: input.provider, email, name, microsoft };
  }

  private membershipProblem(user: User | null, institution: Institution | null, identity: LoginIdentity): Error | null {
    const tagged = (err: Error, institutionId: string | null) =>
      Object.assign(err, { loginEmail: identity.email, loginUserId: user?.id ?? null, loginInstitutionId: institutionId, loginTenantId: identity.microsoft?.tenantId ?? null });
    if (identity.microsoft && institution) {
      try {
        assertMicrosoftEmailTrusted(identity.microsoft, institution);
      } catch (err) {
        return tagged(err as Error, institution.id);
      }
    }
    if (user && !user.active) return tagged(new ForbiddenError('Tu cuenta fue desactivada. Contactá a tu coordinador/a.'), user.institutionId);
    if (!institution || institution.status !== 'ACTIVO') {
      return tagged(new ForbiddenError('Tu institución no está habilitada en Habitar. Contactá a tu coordinador/a.'), institution?.id ?? null);
    }
    return null;
  }

  private async membershipsOf(email: string): Promise<{ user: User; institution: Institution | null }[]> {
    const users = await userRepository.findAllByEmail(email);
    return Promise.all(users.map(async (user) => ({ user, institution: await institutionRepository.findById(user.institutionId) })));
  }

  async institutionChoices(identity: LoginIdentity): Promise<InstitutionChoice[]> {
    const memberships = await this.membershipsOf(identity.email);
    const choice = selectMembership(memberships, (m) => m.user.institutionId, (m) => !this.membershipProblem(m.user, m.institution, identity));
    return choice.kind === 'choose' ? choice.options.map((m) => ({ id: m.user.institutionId, name: m.institution?.name ?? '' })) : [];
  }

  async sessionForIdentity(identity: LoginIdentity, chosenInstitutionId?: string): Promise<Session> {
    const { email } = identity;
    const memberships = await this.membershipsOf(email);
    let existing: User | null = null;
    let institution: Institution | null;
    let isSuperAdmin = false;

    if (memberships.length === 0) {
      isSuperAdmin = env.superAdminEmails.includes(email.toLowerCase());
      institution = isSuperAdmin ? await this.getOrCreateSuperAdminInstitution(email) : await institutionRepository.findByDomain(emailDomain(email));
    } else {
      const choice = selectMembership(memberships, (m) => m.user.institutionId, (m) => !this.membershipProblem(m.user, m.institution, identity), chosenInstitutionId);
      if (choice.kind === 'choose') {
        throw new ChooseInstitutionError(choice.options.map((m) => ({ id: m.user.institutionId, name: m.institution?.name ?? '' })));
      }
      if (choice.kind === 'unknown') {
        throw Object.assign(new ForbiddenError('Tu institución no está habilitada en Habitar. Contactá a tu coordinador/a.'), {
          loginEmail: email,
          loginUserId: null,
          loginInstitutionId: null,
          loginTenantId: identity.microsoft?.tenantId ?? null,
        });
      }
      existing = choice.membership.user;
      institution = choice.membership.institution;
    }

    const problem = this.membershipProblem(existing, institution, identity);
    if (problem) throw problem;
    if (!institution) throw new ForbiddenError('Tu institución no está habilitada en Habitar. Contactá a tu coordinador/a.');

    let user = existing;
    if (!user) {
      user = await userRepository.create({
        name: identity.name ?? email,
        email,
        role: initialRoleFor(email, institution, isSuperAdmin),
        provider: identity.provider,
        institutionId: institution.id,
      });
    }

    user = await userRepository.touchLogin(user.id);
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
  if (role === 'COORDINADOR' || role === 'DIRECTOR') return '/institucional';
  return '/docente/cursos';
}
