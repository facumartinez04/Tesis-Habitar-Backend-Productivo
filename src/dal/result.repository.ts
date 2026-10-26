import { query, queryOne } from '../config/db';

export interface RawAxisAverages {
  literal: number | null;
  inferencial: number | null;
  critico: number | null;
}

export interface RawStudentResult {
  studentId: string;
  studentName: string;
  literal: number | null;
  inferencial: number | null;
  critico: number | null;
  criticoReviewed: boolean;
}

export interface DiagnosticActivityRef {
  activityId: string;
  name: string;
  date: string;
}

export interface RawDiagnosticRow {
  studentId: string;
  studentName: string;
  kind: 'INICIO' | 'CIERRE';
  literal: number | null;
  inferencial: number | null;
  critico: number | null;
}

export interface RawResultHistoryRow {
  activityName: string;
  date: Date;
  literal: number | null;
  inferencial: number | null;
  critico: number | null;
}

export interface ResultRepository {
  getCourseAverages(courseId: string): Promise<RawAxisAverages>;
  getCourseActivityCount(courseId: string): Promise<number>;
  getCourseLatestScoresPerStudent(courseId: string): Promise<RawStudentResult[]>;
  getInstitutionAverages(institutionId: string): Promise<RawAxisAverages>;
  getInstitutionActivityCount(institutionId: string): Promise<number>;
  getStudentHistory(studentId: string): Promise<RawResultHistoryRow[]>;
  getCourseAveragesBetween(courseId: string, from: Date, to: Date): Promise<RawAxisAverages>;
  getDiagnosticActivities(courseId: string): Promise<{ inicio: DiagnosticActivityRef | null; cierre: DiagnosticActivityRef | null }>;
  getLatestResultsForActivities(activityIds: { id: string; kind: 'INICIO' | 'CIERRE' }[]): Promise<RawDiagnosticRow[]>;
  countPendingReviewsByCourse(courseId: string): Promise<number>;
}

interface AveragesRow {
  literal: string | null;
  inferencial: string | null;
  critico: string | null;
}

function avg(value: string | null | undefined): number | null {
  return value === null || value === undefined ? null : Math.round(Number(value));
}

function toAverages(row: AveragesRow | null): RawAxisAverages {
  return {
    literal: avg(row?.literal),
    inferencial: avg(row?.inferencial),
    critico: avg(row?.critico),
  };
}

export class SqlResultRepository implements ResultRepository {
  async getCourseAverages(courseId: string): Promise<RawAxisAverages> {
    const row = await queryOne<AveragesRow>(
      `SELECT AVG(sr."literalScore") AS literal, AVG(sr."inferencialScore") AS inferencial, AVG(sr."criticoScore") AS critico
         FROM "StudentResult" sr
         JOIN "Activity" a ON a."id" = sr."activityId"
        WHERE a."courseId" = $1`,
      [courseId],
    );
    return toAverages(row);
  }

  async getCourseActivityCount(courseId: string): Promise<number> {
    const row = await queryOne<{ count: string }>('SELECT COUNT(*) FROM "Activity" WHERE "courseId" = $1', [courseId]);
    return Number(row?.count ?? 0);
  }

  async getCourseLatestScoresPerStudent(courseId: string): Promise<RawStudentResult[]> {
    const rows = await query<RawStudentResult>(
      `SELECT s."id" AS "studentId", s."name" AS "studentName",
              lr."literalScore" AS literal, lr."inferencialScore" AS inferencial, lr."criticoScore" AS critico,
              COALESCE(lr."criticoReviewed", true) AS "criticoReviewed"
         FROM "Student" s
         LEFT JOIN LATERAL (
           SELECT "literalScore", "inferencialScore", "criticoScore", "criticoReviewed"
             FROM "StudentResult" sr
            WHERE sr."studentId" = s."id"
            ORDER BY sr."createdAt" DESC
            LIMIT 1
         ) lr ON true
        WHERE s."courseId" = $1`,
      [courseId],
    );
    return rows.map((r) => ({
      studentId: r.studentId,
      studentName: r.studentName,
      literal: r.literal ?? null,
      inferencial: r.inferencial ?? null,
      critico: r.critico ?? null,
      criticoReviewed: r.criticoReviewed,
    }));
  }

  async getInstitutionAverages(institutionId: string): Promise<RawAxisAverages> {
    const row = await queryOne<AveragesRow>(
      `SELECT AVG(sr."literalScore") AS literal, AVG(sr."inferencialScore") AS inferencial, AVG(sr."criticoScore") AS critico
         FROM "StudentResult" sr
         JOIN "Activity" a ON a."id" = sr."activityId"
         JOIN "Course" c ON c."id" = a."courseId"
        WHERE c."institutionId" = $1`,
      [institutionId],
    );
    return toAverages(row);
  }

  async getInstitutionActivityCount(institutionId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM "Activity" a JOIN "Course" c ON c."id" = a."courseId" WHERE c."institutionId" = $1`,
      [institutionId],
    );
    return Number(row?.count ?? 0);
  }

  async getCourseAveragesBetween(courseId: string, from: Date, to: Date): Promise<RawAxisAverages> {
    const row = await queryOne<AveragesRow>(
      `SELECT AVG(sr."literalScore") AS literal, AVG(sr."inferencialScore") AS inferencial, AVG(sr."criticoScore") AS critico
         FROM "StudentResult" sr
         JOIN "Activity" a ON a."id" = sr."activityId"
        WHERE a."courseId" = $1 AND sr."createdAt" >= $2 AND sr."createdAt" <= $3`,
      [courseId, from, to],
    );
    return toAverages(row);
  }

  async getStudentHistory(studentId: string): Promise<RawResultHistoryRow[]> {
    return query<RawResultHistoryRow>(
      `SELECT a."name" AS "activityName", sr."createdAt" AS date,
              sr."literalScore" AS literal, sr."inferencialScore" AS inferencial, sr."criticoScore" AS critico
         FROM "StudentResult" sr
         JOIN "Activity" a ON a."id" = sr."activityId"
        WHERE sr."studentId" = $1
        ORDER BY sr."createdAt" DESC`,
      [studentId],
    );
  }

  async getDiagnosticActivities(
    courseId: string,
  ): Promise<{ inicio: DiagnosticActivityRef | null; cierre: DiagnosticActivityRef | null }> {
    const rows = await query<DiagnosticActivityRef & { kind: 'INICIO' | 'CIERRE' }>(
      `SELECT DISTINCT ON ("diagnosticType") "id" AS "activityId", "name", "availableFrom" AS "date", "diagnosticType" AS "kind"
         FROM "Activity"
        WHERE "courseId" = $1 AND "diagnosticType" IS NOT NULL
        ORDER BY "diagnosticType", "createdAt" DESC`,
      [courseId],
    );
    const pick = (kind: 'INICIO' | 'CIERRE') => {
      const row = rows.find((r) => r.kind === kind);
      return row ? { activityId: row.activityId, name: row.name, date: row.date } : null;
    };
    return { inicio: pick('INICIO'), cierre: pick('CIERRE') };
  }

  async getLatestResultsForActivities(activityIds: { id: string; kind: 'INICIO' | 'CIERRE' }[]): Promise<RawDiagnosticRow[]> {
    if (activityIds.length === 0) return [];
    return query<RawDiagnosticRow>(
      `SELECT DISTINCT ON (sr."activityId", sr."studentId")
              sr."studentId", s."name" AS "studentName", k."kind",
              sr."literalScore" AS literal, sr."inferencialScore" AS inferencial, sr."criticoScore" AS critico
         FROM "StudentResult" sr
         JOIN "Student" s ON s."id" = sr."studentId"
         JOIN UNNEST($1::text[], $2::text[]) AS k("activityId", "kind") ON k."activityId" = sr."activityId"
        ORDER BY sr."activityId", sr."studentId", sr."createdAt" DESC`,
      [activityIds.map((a) => a.id), activityIds.map((a) => a.kind)],
    );
  }

  async countPendingReviewsByCourse(courseId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM "Answer" an
         JOIN "Response" r ON r."id" = an."responseId"
         JOIN "Activity" a ON a."id" = r."activityId"
         JOIN "Question" q ON q."id" = an."questionId"
        WHERE a."courseId" = $1 AND q."axis" = 'CRITICO' AND q."type" = 'ABIERTA' AND an."teacherScore" IS NULL`,
      [courseId],
    );
    return Number(row?.count ?? 0);
  }
}

export const resultRepository = new SqlResultRepository();
