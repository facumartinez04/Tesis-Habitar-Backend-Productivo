import { prisma } from '../config/prisma';
import type { RecordAiUsageInput } from '../domain/aiUsage';

export interface AiUsageRepository {
  record(input: RecordAiUsageInput): Promise<void>;
  countSince(institutionId: string, since: Date): Promise<number>;
}

export class PrismaAiUsageRepository implements AiUsageRepository {
  async record(input: RecordAiUsageInput): Promise<void> {
    await prisma.aiUsageEvent.create({
      data: {
        institutionId: input.institutionId,
        provider: input.provider,
        success: input.success,
        wordCount: input.wordCount,
      },
    });
  }

  async countSince(institutionId: string, since: Date): Promise<number> {
    return prisma.aiUsageEvent.count({
      where: { institutionId, success: true, createdAt: { gte: since } },
    });
  }
}

export const aiUsageRepository = new PrismaAiUsageRepository();
