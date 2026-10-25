import type { OAuthProviderId, Role } from './enums';
import type { Locale } from '../i18n/locale';

export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  provider: OAuthProviderId;
  institutionId: string;
  language: Locale | null;

  active: boolean;
}

export interface CreateInstitutionUserInput {
  name: string;
  email: string;
  role: Role;
  provider: OAuthProviderId;
  institutionId: string;
}
