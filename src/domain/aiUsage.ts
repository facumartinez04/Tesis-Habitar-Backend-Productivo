export interface AiUsageSnapshot {
  institutionId: string;
  periodLabel: string;
  used: number;
  quota: number;
  remaining: number;
  overQuota: boolean;
  /** Gasto del mes con la clave de la plataforma, en dólares. */
  spentUsd: number;
  /** Tope de gasto mensual en dólares; null = sin tope. */
  budgetUsd: number | null;
  overBudget: boolean;
}

export interface RecordAiUsageInput {
  institutionId: string;
  provider: string;
  success: boolean;
  wordCount: number;
  /** GENERACION de preguntas (cuenta para la cuota) o CORRECCION de respuestas abiertas. */
  kind?: AiUsageKind;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  /** PLATAFORMA: la paga Habitar. PROPIA: la institución usa su clave. */
  keySource?: 'PLATAFORMA' | 'PROPIA';
}

/** AYUDA: dudas de los alumnos sobre el texto (no consume la cuota de generación). */
export type AiUsageKind = 'GENERACION' | 'CORRECCION' | 'AYUDA';
