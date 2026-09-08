import type { OAuthProviderId, Role } from './enums';
import type { User } from './user';

export interface Session {
  token: string;
  user: User;
}

export interface JwtPayload {
  sub: string;
  role: Role;
  institutionId: string;
  provider: OAuthProviderId;
  realRole?: Role;
  impersonated?: boolean;
}
