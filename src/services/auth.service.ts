import { userRepository } from '../repositories/user.repository';
import { signToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/http-error';
import type { OAuthProviderId, Role } from '../domain/enums';
import type { Session } from '../domain/auth';

const providerDefaultRole: Record<OAuthProviderId, Role> = {
  GOOGLE: 'DOCENTE',
  MICROSOFT: 'COORDINADOR',
};

export interface AuthService {
  loginWithProvider(provider: OAuthProviderId): Promise<Session>;
  getSessionUser(userId: string): Promise<Session['user']>;
  createAdminSession(): Promise<Session>;
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
}

export const authService = new DefaultAuthService();

export function dashboardPathForRole(role: Role): string {
  if (role === 'ADMIN') return '/admin/instituciones/nueva';
  if (role === 'COORDINADOR') return '/institucional';
  return '/docente/cursos';
}
