import type { AiUsageKind } from './aiUsage';

export interface AiCostBreakdownRow {
  kind: AiUsageKind;
  provider: string;
  model: string | null;
  keySource: 'PLATAFORMA' | 'PROPIA';
  calls: number;
  failed: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export interface AiCostMonthRow {
  month: string;
  platformCostUsd: number;
  ownCostUsd: number;
  calls: number;
}

export interface AiCostInstitution {
  institutionId: string;
  name: string;
  keySource: string;
  provider: string;
  budgetUsd: number | null;
}

export interface AiCostKindSummary {
  kind: AiUsageKind;
  calls: number;
  failed: number;
  tokens: number;
  platformCostUsd: number;
  ownCostUsd: number;
  sharePct: number;
}

export interface AiCostModelSummary {
  provider: string;
  model: string;
  keySource: 'PLATAFORMA' | 'PROPIA';
  calls: number;
  tokens: number;
  costUsd: number;
}

export interface InstitutionAiCostDetail {
  institution: AiCostInstitution;
  month: string;
  currentMonth: string;
  totals: {
    calls: number;
    failed: number;
    promptTokens: number;
    completionTokens: number;
    platformCostUsd: number;
    ownCostUsd: number;
  };
  budgetUsedPct: number | null;
  overBudget: boolean;
  byKind: AiCostKindSummary[];
  byModel: AiCostModelSummary[];
  history: AiCostMonthRow[];
}
