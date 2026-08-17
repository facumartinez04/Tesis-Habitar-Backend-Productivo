import type { OAuthProviderId, Role } from './enums';

export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  provider: OAuthProviderId;
  institutionId: string;

  active: boolean;
}

export interface CreateInstitutionUserInput {
  name: string;
  email: string;
  role: Role;
  provider: OAuthProviderId;
  institutionId: string;
}
