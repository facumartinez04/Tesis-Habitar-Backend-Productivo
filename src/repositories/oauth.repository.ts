import { prisma } from '../config/prisma';
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

export class PrismaOAuthIntegrationRepository implements OAuthIntegrationRepository {
  async findByInstitution(institutionId: string): Promise<RawOAuthIntegration | null> {
    const record = await prisma.oAuthIntegration.findUnique({ where: { institutionId } });
    return record
      ? {
          institutionId: record.institutionId,
          provider: record.provider,
          clientId: record.clientId,
          currentStepIndex: record.currentStepIndex,
        }
      : null;
  }

  async advanceStep(institutionId: string, nextStepIndex: number): Promise<RawOAuthIntegration | null> {
    const record = await prisma.oAuthIntegration.update({
      where: { institutionId },
      data: { currentStepIndex: nextStepIndex },
    });
    return {
      institutionId: record.institutionId,
      provider: record.provider,
      clientId: record.clientId,
      currentStepIndex: record.currentStepIndex,
    };
  }
}

export const oauthIntegrationRepository = new PrismaOAuthIntegrationRepository();
