import { query, queryOne } from '../config/db';
import type { RetentionPolicy } from '../domain/compliance';

export interface RetentionRepository {
  get(institutionId: string): Promise<RetentionPolicy>;
  setRetentionMonths(institutionId: string, months: number): Promise<RetentionPolicy>;
  markPurged(institutionId: string): Promise<void>;
  findStudentsEligibleForPurge(institutionId: string, cutoff: Date): Promise<{ id: string; name: string }[]>;
  deleteStudents(ids: string[]): Promise<number>;
}

const DEFAULT_RETENTION_MONTHS = 24;

export class SqlRetentionRepository implements RetentionRepository {
  async get(institutionId: string): Promise<RetentionPolicy> {
    const row = await queryOne<RetentionPolicy>(
      `INSERT INTO "RetentionPolicy" ("institutionId", "retentionMonths")
       VALUES ($1, $2)
       ON CONFLICT ("institutionId") DO UPDATE SET "institutionId" = EXCLUDED."institutionId"
       RETURNING "institutionId", "retentionMonths", "lastPurgeAt"`,
      [institutionId, DEFAULT_RETENTION_MONTHS],
    );
    return row!;
  }

  async setRetentionMonths(institutionId: string, months: number): Promise<RetentionPolicy> {
    const row = await queryOne<RetentionPolicy>(
      `INSERT INTO "RetentionPolicy" ("institutionId", "retentionMonths")
       VALUES ($1, $2)
       ON CONFLICT ("institutionId") DO UPDATE SET "retentionMonths" = EXCLUDED."retentionMonths", "updatedAt" = now()
       RETURNING "institutionId", "retentionMonths", "lastPurgeAt"`,
      [institutionId, months],
    );
    return row!;
  }

  async markPurged(institutionId: string): Promise<void> {
    await query('UPDATE "RetentionPolicy" SET "lastPurgeAt" = now() WHERE "institutionId" = $1', [institutionId]);
  }

  async findStudentsEligibleForPurge(institutionId: string, cutoff: Date): Promise<{ id: string; name: string }[]> {
    return query<{ id: string; name: string }>(
      `SELECT s."id", s."name" FROM "Student" s
         JOIN "Course" c ON c."id" = s."courseId"
        WHERE c."institutionId" = $1 AND s."createdAt" < $2`,
      [institutionId, cutoff],
    );
  }

  async deleteStudents(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await query('DELETE FROM "Student" WHERE "id" = ANY($1) RETURNING "id"', [ids]);
    return result.length;
  }
}

export const retentionRepository = new SqlRetentionRepository();
