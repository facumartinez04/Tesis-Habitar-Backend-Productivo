export interface AiUsageSnapshot {
  institutionId: string;
  periodLabel: string;
  used: number;
  quota: number;
  remaining: number;
  overQuota: boolean;
}

export interface RecordAiUsageInput {
  institutionId: string;
  provider: string;
  success: boolean;
  wordCount: number;
}
