import { queryOne } from '../config/db';
import type { OAuthProviderId } from '../domain/enums';

export interface RawOAuthIntegration {
  institutionId: string;
  provider: OAuthProviderId;
  clientId: string;
  currentStepIndex: number;
}

export interface OAuthIntegrationRepository {
  findByInstitution(institutionId: string): Promise<RawOAuthIntegration | null>;
  advanceStep(institutionId: string, nextStepIndex: number): Promise<RawOAuthIntegration | null>;
}

export class SqlOAuthIntegrationRepository implements OAuthIntegrationRepository {
  async findByInstitution(institutionId: string): Promise<RawOAuthIntegration | null> {
    return queryOne<RawOAuthIntegration>('SELECT * FROM "OAuthIntegration" WHERE "institutionId" = $1', [institutionId]);
  }

  async advanceStep(institutionId: string, nextStepIndex: number): Promise<RawOAuthIntegration | null> {
    return queryOne<RawOAuthIntegration>(
      'UPDATE "OAuthIntegration" SET "currentStepIndex" = $1 WHERE "institutionId" = $2 RETURNING *',
      [nextStepIndex, institutionId],
    );
  }
}

export const oauthIntegrationRepository = new SqlOAuthIntegrationRepository();
