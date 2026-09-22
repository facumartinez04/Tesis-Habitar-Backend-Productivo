import { aiUsageRepository } from '../repositories/aiUsage.repository';
import { institutionRepository } from '../repositories/institution.repository';
import type { AiUsageSnapshot, RecordAiUsageInput } from '../domain/aiUsage';

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function periodLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export interface AiUsageService {
  record(input: RecordAiUsageInput): Promise<void>;
  getSnapshot(institutionId: string): Promise<AiUsageSnapshot>;
  hasQuotaAvailable(institutionId: string): Promise<boolean>;
}

export class DefaultAiUsageService implements AiUsageService {
  async record(input: RecordAiUsageInput): Promise<void> {
    await aiUsageRepository.record(input);
  }

  async getSnapshot(institutionId: string): Promise<AiUsageSnapshot> {
    const [used, quota] = await Promise.all([
      aiUsageRepository.countSince(institutionId, startOfCurrentMonth()),
      institutionRepository.getAiMonthlyQuota(institutionId),
    ]);

    return {
      institutionId,
      periodLabel: periodLabel(),
      used,
      quota,
      remaining: Math.max(quota - used, 0),
      overQuota: used >= quota,
    };
  }

  async hasQuotaAvailable(institutionId: string): Promise<boolean> {
    const snapshot = await this.getSnapshot(institutionId);
    return !snapshot.overQuota;
  }
}

export const aiUsageService = new DefaultAiUsageService();
