import { pool, query, queryOne } from '../config/db';
import type { RecordAiUsageInput } from '../domain/aiUsage';

export interface AiPriceRow {
  provider: string;
  model: string;
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
  updatedAt: Date;
}

export interface InstitutionAiCostRow {
  institutionId: string;
  name: string;
  keySource: string;
  provider: string;
  budgetUsd: number | null;
  calls: number;
  failed: number;
  generation: number;
  grading: number;
  help: number;
  promptTokens: number;
  completionTokens: number;
  platformCostUsd: number;
  ownCostUsd: number;
  generationCostUsd: number;
  gradingCostUsd: number;
  helpCostUsd: number;
}

/** Comienzo de un mes en hora argentina (UTC−3), como texto ISO para comparar contra "createdAt" (UTC). */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1, 3, 0, 0));
  const to = new Date(Date.UTC(y, m, 1, 3, 0, 0));
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Mes actual en hora argentina (AAAA-MM). */
export function currentMonthAR(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 7);
}

const num = (v: unknown) => Number(v ?? 0);

export interface AiUsageRepository {
  record(input: RecordAiUsageInput): Promise<void>;
  countSince(institutionId: string, since: Date): Promise<number>;
}

export class SqlAiUsageRepository implements AiUsageRepository {
  /**
   * Registra la llamada con su costo: tokens × precio del modelo (o, si el modelo no está en la tabla, el último
   * precio cargado de ese proveedor).
   */
  async record(input: RecordAiUsageInput): Promise<void> {
    await pool.query(
      `INSERT INTO "AiUsageEvent"
         ("institutionId", "provider", "success", "wordCount", "kind", "model", "promptTokens", "completionTokens", "keySource", "costUsd")
       SELECT $1, $2::text, $3, $4, $5, $6::text, $7::int, $8::int, $9,
              COALESCE(
                (SELECT ($7::int * p."inputPerMTokUsd" + $8::int * p."outputPerMTokUsd") / 1000000 FROM "AiPrice" p
                  WHERE p."provider" = UPPER($2::text) AND p."model" = $6::text),
                (SELECT ($7::int * p."inputPerMTokUsd" + $8::int * p."outputPerMTokUsd") / 1000000 FROM "AiPrice" p
                  WHERE p."provider" = UPPER($2::text) ORDER BY p."updatedAt" DESC LIMIT 1),
                0)`,
      [
        input.institutionId,
        input.provider,
        input.success,
        input.wordCount,
        input.kind ?? 'GENERACION',
        input.model ?? null,
        input.promptTokens ?? 0,
        input.completionTokens ?? 0,
        input.keySource ?? 'PLATAFORMA',
      ],
    );
  }

  async countSince(institutionId: string, since: Date): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM "AiUsageEvent" WHERE "institutionId" = $1 AND "success" = true AND "kind" = 'GENERACION' AND "createdAt" >= $2`,
      [institutionId, since],
    );
    return Number(row?.count ?? 0);
  }

  /** Gasto del mes con la clave de la plataforma. */
  async platformSpend(institutionId: string, month: string): Promise<number> {
    const { from, to } = monthRange(month);
    const row = await queryOne<{ total: string }>(
      `SELECT COALESCE(SUM("costUsd"), 0) AS "total" FROM "AiUsageEvent"
        WHERE "institutionId" = $1 AND "keySource" = 'PLATAFORMA'
          AND "createdAt" >= ($2::timestamptz AT TIME ZONE 'UTC') AND "createdAt" < ($3::timestamptz AT TIME ZONE 'UTC')`,
      [institutionId, from, to],
    );
    return num(row?.total);
  }

  /** Costo y uso de cada institución en el mes. */
  async costByInstitution(month: string): Promise<InstitutionAiCostRow[]> {
    const { from, to } = monthRange(month);
    const rows = await query(
      `SELECT i."id" AS "institutionId", i."name", i."aiKeySource" AS "keySource", i."aiProvider" AS "provider",
              i."aiMonthlyBudgetUsd" AS "budgetUsd",
              COUNT(e."id") FILTER (WHERE e."success") AS "calls",
              COUNT(e."id") FILTER (WHERE NOT e."success") AS "failed",
              COUNT(e."id") FILTER (WHERE e."success" AND e."kind" = 'GENERACION') AS "generation",
              COUNT(e."id") FILTER (WHERE e."success" AND e."kind" = 'CORRECCION') AS "grading",
              COUNT(e."id") FILTER (WHERE e."success" AND e."kind" = 'AYUDA') AS "help",
              COALESCE(SUM(e."promptTokens"), 0) AS "promptTokens",
              COALESCE(SUM(e."completionTokens"), 0) AS "completionTokens",
              COALESCE(SUM(e."costUsd") FILTER (WHERE e."keySource" = 'PLATAFORMA'), 0) AS "platformCostUsd",
              COALESCE(SUM(e."costUsd") FILTER (WHERE e."keySource" = 'PROPIA'), 0) AS "ownCostUsd",
              COALESCE(SUM(e."costUsd") FILTER (WHERE e."kind" = 'GENERACION'), 0) AS "generationCostUsd",
              COALESCE(SUM(e."costUsd") FILTER (WHERE e."kind" = 'CORRECCION'), 0) AS "gradingCostUsd",
              COALESCE(SUM(e."costUsd") FILTER (WHERE e."kind" = 'AYUDA'), 0) AS "helpCostUsd"
         FROM "Institution" i
         LEFT JOIN "AiUsageEvent" e ON e."institutionId" = i."id"
          AND e."createdAt" >= ($1::timestamptz AT TIME ZONE 'UTC') AND e."createdAt" < ($2::timestamptz AT TIME ZONE 'UTC')
        GROUP BY i."id"
        ORDER BY "platformCostUsd" DESC, i."name" ASC`,
      [from, to],
    );
    return rows.map((r: Record<string, unknown>) => ({
      institutionId: String(r.institutionId),
      name: String(r.name),
      keySource: String(r.keySource ?? 'PLATFORM'),
      provider: String(r.provider ?? 'DEEPSEEK'),
      budgetUsd: r.budgetUsd === null || r.budgetUsd === undefined ? null : num(r.budgetUsd),
      calls: num(r.calls),
      failed: num(r.failed),
      generation: num(r.generation),
      grading: num(r.grading),
      help: num(r.help),
      promptTokens: num(r.promptTokens),
      completionTokens: num(r.completionTokens),
      platformCostUsd: num(r.platformCostUsd),
      ownCostUsd: num(r.ownCostUsd),
      generationCostUsd: num(r.generationCostUsd),
      gradingCostUsd: num(r.gradingCostUsd),
      helpCostUsd: num(r.helpCostUsd),
    }));
  }

  /** Gasto total de la plataforma por mes (últimos `months` meses, del más viejo al actual). */
  async monthlyTotals(months: number): Promise<{ month: string; costUsd: number; calls: number }[]> {
    const current = currentMonthAR();
    const [y, m] = current.split('-').map(Number);
    const out: { month: string; costUsd: number; calls: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      const month = d.toISOString().slice(0, 7);
      const { from, to } = monthRange(month);
      const row = await queryOne<{ cost: string; calls: string }>(
        `SELECT COALESCE(SUM("costUsd") FILTER (WHERE "keySource" = 'PLATAFORMA'), 0) AS "cost", COUNT(*) FILTER (WHERE "success") AS "calls"
           FROM "AiUsageEvent"
          WHERE "createdAt" >= ($1::timestamptz AT TIME ZONE 'UTC') AND "createdAt" < ($2::timestamptz AT TIME ZONE 'UTC')`,
        [from, to],
      );
      out.push({ month, costUsd: num(row?.cost), calls: num(row?.calls) });
    }
    return out;
  }

  /** Modelos usados en el mes, con sus llamadas y si tienen precio propio en la tabla. */
  async modelsUsed(month: string): Promise<{ provider: string; model: string; calls: number; hasPrice: boolean }[]> {
    const { from, to } = monthRange(month);
    const rows = await query(
      `SELECT UPPER(e."provider") AS "provider", e."model", COUNT(*) AS "calls", (p."model" IS NOT NULL) AS "hasPrice"
         FROM "AiUsageEvent" e
         LEFT JOIN "AiPrice" p ON p."provider" = UPPER(e."provider") AND p."model" = e."model"
        WHERE e."model" IS NOT NULL
          AND e."createdAt" >= ($1::timestamptz AT TIME ZONE 'UTC') AND e."createdAt" < ($2::timestamptz AT TIME ZONE 'UTC')
        GROUP BY UPPER(e."provider"), e."model", p."model"
        ORDER BY "calls" DESC`,
      [from, to],
    );
    return rows.map((r: Record<string, unknown>) => ({
      provider: String(r.provider),
      model: String(r.model),
      calls: num(r.calls),
      hasPrice: Boolean(r.hasPrice),
    }));
  }

  async listPrices(): Promise<AiPriceRow[]> {
    const rows = await query('SELECT * FROM "AiPrice" ORDER BY "provider", "model"');
    return rows.map((r: Record<string, unknown>) => ({
      provider: String(r.provider),
      model: String(r.model),
      inputPerMTokUsd: num(r.inputPerMTokUsd),
      outputPerMTokUsd: num(r.outputPerMTokUsd),
      updatedAt: r.updatedAt as Date,
    }));
  }

  async upsertPrice(input: { provider: string; model: string; inputPerMTokUsd: number; outputPerMTokUsd: number }): Promise<void> {
    await query(
      `INSERT INTO "AiPrice" ("provider", "model", "inputPerMTokUsd", "outputPerMTokUsd") VALUES ($1, $2, $3, $4)
       ON CONFLICT ("provider", "model") DO UPDATE SET
         "inputPerMTokUsd" = EXCLUDED."inputPerMTokUsd", "outputPerMTokUsd" = EXCLUDED."outputPerMTokUsd", "updatedAt" = CURRENT_TIMESTAMP`,
      [input.provider.toUpperCase(), input.model.trim(), input.inputPerMTokUsd, input.outputPerMTokUsd],
    );
  }

  async deletePrice(provider: string, model: string): Promise<void> {
    await query('DELETE FROM "AiPrice" WHERE "provider" = $1 AND "model" = $2', [provider.toUpperCase(), model]);
  }

  async getBudget(institutionId: string): Promise<number | null> {
    const row = await queryOne<{ budget: string | null }>('SELECT "aiMonthlyBudgetUsd" AS "budget" FROM "Institution" WHERE "id" = $1', [
      institutionId,
    ]);
    return row?.budget === null || row?.budget === undefined ? null : Number(row.budget);
  }

  async setBudget(institutionId: string, budgetUsd: number | null): Promise<void> {
    await query('UPDATE "Institution" SET "aiMonthlyBudgetUsd" = $2 WHERE "id" = $1', [institutionId, budgetUsd]);
  }
}

export const aiUsageRepository = new SqlAiUsageRepository();
