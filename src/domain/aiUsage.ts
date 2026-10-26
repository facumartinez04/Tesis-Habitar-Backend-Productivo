export interface AiUsageSnapshot {
  institutionId: string;
  periodLabel: string;
  used: number;
  quota: number;
  remaining: number;
  overQuota: boolean;
  spentUsd: number;
  budgetUsd: number | null;
  overBudget: boolean;
}

export interface RecordAiUsageInput {
  institutionId: string;
  provider: string;
  success: boolean;
  wordCount: number;
  kind?: AiUsageKind;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  keySource?: 'PLATAFORMA' | 'PROPIA';
}

export type AiUsageKind = 'GENERACION' | 'CORRECCION' | 'AYUDA' | 'DOCUMENTO';
