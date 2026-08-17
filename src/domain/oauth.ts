import type { OAuthProviderId } from './enums';

export type IntegrationStepState = 'DONE' | 'WAIT' | 'TODO';

export interface IntegrationStep {
  id: string;
  label: string;
  state: IntegrationStepState;
  note?: string;
}

export interface OAuthIntegration {
  institutionId: string;
  provider: OAuthProviderId;
  clientId: string;
  steps: IntegrationStep[];
}
