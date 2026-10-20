import { query, queryOne } from '../config/db';

export type ProgressPhase = 'LEYENDO' | 'RESPONDIENDO' | 'ENVIADO';

export interface ProgressRow {
  id: string;
  activityId: string;
  studentKey: string;
  studentDisplayName: string;
  deviceId: string;
  phase: ProgressPhase;
  currentIndex: number;
  answeredCount: number;
  draftJson: string | null;
  startedAt: Date;
  updatedAt: Date;
}

export interface IntegrityEventRow {
  id: string;
  kind: 'OTRO_DISPOSITIVO' | 'DISPOSITIVO_COMPARTIDO';
  studentDisplayName: string;
  otherStudent: string | null;
  createdAt: Date;
}

const COLUMNS = `"id", "activityId", "studentKey", "studentDisplayName", "deviceId", "phase", "currentIndex",
  "answeredCount", "draftJson", "startedAt", "updatedAt"`;

export class SqlProgressRepository {
  async find(activityId: string, studentKey: string): Promise<ProgressRow | null> {
    return queryOne<ProgressRow>(`SELECT ${COLUMNS} FROM "ActivityProgress" WHERE "activityId" = $1 AND "studentKey" = $2`, [
      activityId,
      studentKey,
    ]);
  }

  async upsert(input: {
    activityId: string;
    studentKey: string;
    studentDisplayName: string;
    deviceId: string;
    phase: ProgressPhase;
    currentIndex: number;
    answeredCount: number;
    draftJson: string | null;
  }): Promise<ProgressRow> {
    const row = await queryOne<ProgressRow>(
      `INSERT INTO "ActivityProgress"
         ("activityId", "studentKey", "studentDisplayName", "deviceId", "phase", "currentIndex", "answeredCount", "draftJson")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT ("activityId", "studentKey") DO UPDATE SET
         "phase" = CASE WHEN "ActivityProgress"."phase" = 'ENVIADO' THEN 'ENVIADO' ELSE EXCLUDED."phase" END,
         "currentIndex" = EXCLUDED."currentIndex",
         "answeredCount" = EXCLUDED."answeredCount",
         "draftJson" = CASE WHEN "ActivityProgress"."phase" = 'ENVIADO' THEN "ActivityProgress"."draftJson" ELSE EXCLUDED."draftJson" END,
         "updatedAt" = CURRENT_TIMESTAMP
       RETURNING ${COLUMNS}`,
      [
        input.activityId,
        input.studentKey,
        input.studentDisplayName,
        input.deviceId,
        input.phase,
        input.currentIndex,
        input.answeredCount,
        input.draftJson,
      ],
    );
    return row!;
  }

  async markSubmitted(input: {
    activityId: string;
    studentKey: string;
    studentDisplayName: string;
    deviceId: string;
    answeredCount: number;
  }): Promise<void> {
    await query(
      `INSERT INTO "ActivityProgress" ("activityId", "studentKey", "studentDisplayName", "deviceId", "phase", "answeredCount")
       VALUES ($1, $2, $3, $4, 'ENVIADO', $5)
       ON CONFLICT ("activityId", "studentKey") DO UPDATE SET
         "phase" = 'ENVIADO', "answeredCount" = EXCLUDED."answeredCount", "draftJson" = NULL, "updatedAt" = CURRENT_TIMESTAMP`,
      [input.activityId, input.studentKey, input.studentDisplayName, input.deviceId, input.answeredCount],
    );
  }

  async reopen(activityId: string, studentKey: string): Promise<void> {
    await query(
      `UPDATE "ActivityProgress" SET "phase" = 'RESPONDIENDO', "currentIndex" = 0, "answeredCount" = 0, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "activityId" = $1 AND "studentKey" = $2`,
      [activityId, studentKey],
    );
  }

  async listByActivity(activityId: string): Promise<ProgressRow[]> {
    return query<ProgressRow>(`SELECT ${COLUMNS} FROM "ActivityProgress" WHERE "activityId" = $1 ORDER BY "startedAt"`, [activityId]);
  }

  async otherStudentsOnDevice(activityId: string, deviceId: string, studentKey: string): Promise<string[]> {
    const rows = await query<{ studentDisplayName: string }>(
      `SELECT "studentDisplayName" FROM "ActivityProgress" WHERE "activityId" = $1 AND "deviceId" = $2 AND "studentKey" <> $3`,
      [activityId, deviceId, studentKey],
    );
    return rows.map((r) => r.studentDisplayName);
  }

  async addIntegrityEvent(input: {
    activityId: string;
    kind: IntegrityEventRow['kind'];
    studentDisplayName: string;
    otherStudent: string | null;
    deviceId: string;
  }): Promise<boolean> {
    const rows = await query<{ id: string }>(
      `INSERT INTO "ActivityIntegrityEvent" ("activityId", "kind", "studentDisplayName", "otherStudent", "deviceId")
       SELECT $1, $2, $3, $4, $5
        WHERE NOT EXISTS (
          SELECT 1 FROM "ActivityIntegrityEvent"
           WHERE "activityId" = $1 AND "kind" = $2 AND "studentDisplayName" = $3 AND "deviceId" = $5
             AND COALESCE("otherStudent", '') = COALESCE($4, '')
        )
       RETURNING "id"`,
      [input.activityId, input.kind, input.studentDisplayName, input.otherStudent, input.deviceId],
    );
    return rows.length > 0;
  }

  async listIntegrityEvents(activityId: string): Promise<IntegrityEventRow[]> {
    return query<IntegrityEventRow>(
      `SELECT "id", "kind", "studentDisplayName", "otherStudent", "createdAt"
         FROM "ActivityIntegrityEvent" WHERE "activityId" = $1 ORDER BY "createdAt" DESC`,
      [activityId],
    );
  }
}

export const progressRepository = new SqlProgressRepository();
