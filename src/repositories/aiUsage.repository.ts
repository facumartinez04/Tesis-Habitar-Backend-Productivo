import { pool, queryOne } from '../config/db';
import type { RecordAiUsageInput } from '../domain/aiUsage';

export interface AiUsageRepository {
  record(input: RecordAiUsageInput): Promise<void>;
  countSince(institutionId: string, since: Date): Promise<number>;
}

export class SqlAiUsageRepository implements AiUsageRepository {
  async record(input: RecordAiUsageInput): Promise<void> {
    await pool.query(
      `INSERT INTO "AiUsageEvent" ("institutionId", "provider", "success", "wordCount")
       VALUES ($1, $2, $3, $4)`,
      [input.institutionId, input.provider, input.success, input.wordCount],
    );
  }

  async countSince(institutionId: string, since: Date): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM "AiUsageEvent" WHERE "institutionId" = $1 AND "success" = true AND "createdAt" >= $2`,
      [institutionId, since],
    );
    return Number(row?.count ?? 0);
  }
}

export const aiUsageRepository = new SqlAiUsageRepository();
