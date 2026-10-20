import { query, queryOne } from '../config/db';
import type { PerformanceAlert } from '../domain/alert';

interface AlertRow {
  id: string;
  courseId: string;
  courseName: string;
  teacherName: string;
  axis: PerformanceAlert['axis'];
  currentValue: number;
  threshold: number;
  severity: PerformanceAlert['severity'];
  detectedAt: string;
  message: string;
}

function toDomain(row: AlertRow): PerformanceAlert {
  return {
    id: row.id,
    courseId: row.courseId,
    courseName: row.courseName,
    teacherName: row.teacherName,
    axis: row.axis,
    currentValue: row.currentValue,
    threshold: row.threshold,
    severity: row.severity,
    detectedAt: row.detectedAt,
    message: row.message,
  };
}

export interface OpenAlertRow {
  id: string;
  axis: PerformanceAlert['axis'];
  severity: PerformanceAlert['severity'];
}

export type AxisAverages = Record<PerformanceAlert['axis'], number | null>;

export interface AlertRepository {
  findByInstitution(institutionId: string): Promise<PerformanceAlert[]>;
  countOpenByInstitution(institutionId: string): Promise<number>;
  findOpenByCourse(courseId: string): Promise<OpenAlertRow[]>;
  open(input: Omit<PerformanceAlert, 'id' | 'courseName' | 'teacherName'>): Promise<void>;
  update(id: string, currentValue: number, severity: PerformanceAlert['severity'], message: string): Promise<void>;
  resolve(id: string, currentValue: number): Promise<void>;
  recentCourseAverages(courseId: string, lastActivities: number): Promise<AxisAverages>;
}

export class SqlAlertRepository implements AlertRepository {
  async findByInstitution(institutionId: string): Promise<PerformanceAlert[]> {
    const rows = await query<AlertRow>(
      `SELECT pa.*, c."name" AS "courseName", u."name" AS "teacherName"
         FROM "PerformanceAlert" pa
         JOIN "Course" c ON c."id" = pa."courseId"
         JOIN "User" u ON u."id" = c."teacherId"
        WHERE c."institutionId" = $1
        ORDER BY (pa."severity" = 'RESUELTA'), pa."currentValue"`,
      [institutionId],
    );
    return rows.map(toDomain);
  }

  async countOpenByInstitution(institutionId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM "PerformanceAlert" pa
         JOIN "Course" c ON c."id" = pa."courseId"
        WHERE c."institutionId" = $1 AND pa."severity" <> 'RESUELTA'`,
      [institutionId],
    );
    return Number(row?.count ?? 0);
  }

  async findOpenByCourse(courseId: string): Promise<OpenAlertRow[]> {
    return query<OpenAlertRow>(
      `SELECT "id", "axis", "severity" FROM "PerformanceAlert" WHERE "courseId" = $1 AND "severity" <> 'RESUELTA'`,
      [courseId],
    );
  }

  async open(input: Omit<PerformanceAlert, 'id' | 'courseName' | 'teacherName'>): Promise<void> {
    await query(
      `INSERT INTO "PerformanceAlert" ("courseId", "axis", "currentValue", "threshold", "severity", "detectedAt", "message")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [input.courseId, input.axis, input.currentValue, input.threshold, input.severity, input.detectedAt, input.message],
    );
  }

  async update(id: string, currentValue: number, severity: PerformanceAlert['severity'], message: string): Promise<void> {
    await query('UPDATE "PerformanceAlert" SET "currentValue" = $1, "severity" = $2, "message" = $3 WHERE "id" = $4', [
      currentValue,
      severity,
      message,
      id,
    ]);
  }

  async resolve(id: string, currentValue: number): Promise<void> {
    await query(
      `UPDATE "PerformanceAlert"
          SET "severity" = 'RESUELTA', "currentValue" = $1, "resolvedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $2`,
      [currentValue, id],
    );
  }

  async recentCourseAverages(courseId: string, lastActivities: number): Promise<AxisAverages> {
    const row = await queryOne<{ literal: string | null; inferencial: string | null; critico: string | null }>(
      `WITH recientes AS (
         SELECT a."id" FROM "Activity" a
          WHERE a."courseId" = $1
            AND EXISTS (SELECT 1 FROM "StudentResult" sr WHERE sr."activityId" = a."id")
          ORDER BY a."createdAt" DESC
          LIMIT $2
       ), ultimos AS (
         SELECT DISTINCT ON (sr."activityId", sr."studentId") sr.*
           FROM "StudentResult" sr
          WHERE sr."activityId" IN (SELECT "id" FROM recientes)
          ORDER BY sr."activityId", sr."studentId", sr."createdAt" DESC
       )
       SELECT AVG("literalScore") AS literal, AVG("inferencialScore") AS inferencial, AVG("criticoScore") AS critico
         FROM ultimos`,
      [courseId, lastActivities],
    );
    const num = (v: string | null | undefined) => (v === null || v === undefined ? null : Math.round(Number(v)));
    return { LITERAL: num(row?.literal), INFERENCIAL: num(row?.inferencial), CRITICO: num(row?.critico) };
  }
}

export const alertRepository = new SqlAlertRepository();
