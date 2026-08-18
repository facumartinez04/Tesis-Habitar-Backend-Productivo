import { query, queryOne } from '../config/db';

export interface RawAxisAverages {
  literal: number;
  inferencial: number;
  critico: number;
}

export interface RawStudentResult {
  studentId: string;
  studentName: string;
  literal: number | null;
  inferencial: number | null;
  critico: number | null;
}

export interface RawResultHistoryRow {
  activityName: string;
  date: Date;
  literal: number;
  inferencial: number;
  critico: number;
}

export interface ResultRepository {
  getCourseAverages(courseId: string): Promise<RawAxisAverages>;
  getCourseActivityCount(courseId: string): Promise<number>;
  getCourseLatestScoresPerStudent(courseId: string): Promise<RawStudentResult[]>;
  getInstitutionAverages(institutionId: string): Promise<RawAxisAverages>;
  getInstitutionActivityCount(institutionId: string): Promise<number>;
  getStudentHistory(studentId: string): Promise<RawResultHistoryRow[]>;
  getCourseAveragesBetween(courseId: string, from: Date, to: Date): Promise<RawAxisAverages>;
}

interface AveragesRow {
  literal: string | null;
  inferencial: string | null;
  critico: string | null;
}

function toAverages(row: AveragesRow | null): RawAxisAverages {
  return {
    literal: row?.literal ? Math.round(Number(row.literal)) : 0,
    inferencial: row?.inferencial ? Math.round(Number(row.inferencial)) : 0,
    critico: row?.critico ? Math.round(Number(row.critico)) : 0,
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
              lr."literalScore" AS literal, lr."inferencialScore" AS inferencial, lr."criticoScore" AS critico
         FROM "Student" s
         LEFT JOIN LATERAL (
           SELECT "literalScore", "inferencialScore", "criticoScore"
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
}

export const resultRepository = new SqlResultRepository();
