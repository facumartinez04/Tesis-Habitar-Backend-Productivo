import type { InstitutionStatus } from './enums';

export interface OAuthAccessStatus {
  institutionId: string;
  domain: string;
  coordinatorEmail: string;
  institutionStatus: InstitutionStatus;
  googleConfigured: boolean;
  microsoftConfigured: boolean;
}
