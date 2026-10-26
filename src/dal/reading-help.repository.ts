import { query, queryOne } from '../config/db';

export interface ReadingHelpRow {
  id: string;
  activityId: string;
  studentKey: string;
  studentDisplayName: string;
  question: string;
  answer: string;
  declined: boolean;
  createdAt: Date;
}

export class SqlReadingHelpRepository {
  async add(input: Omit<ReadingHelpRow, 'id' | 'createdAt'>): Promise<ReadingHelpRow> {
    const row = await queryOne<ReadingHelpRow>(
      `INSERT INTO "ReadingHelpMessage" ("activityId", "studentKey", "studentDisplayName", "question", "answer", "declined")
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [input.activityId, input.studentKey, input.studentDisplayName, input.question, input.answer, input.declined],
    );
    return row!;
  }

  async listForStudent(activityId: string, studentKey: string): Promise<ReadingHelpRow[]> {
    return query<ReadingHelpRow>(
      `SELECT * FROM "ReadingHelpMessage" WHERE "activityId" = $1 AND "studentKey" = $2 ORDER BY "createdAt"`,
      [activityId, studentKey],
    );
  }

  async listForStudentInCourse(courseId: string, studentKey: string): Promise<(ReadingHelpRow & { activityName: string })[]> {
    return query<ReadingHelpRow & { activityName: string }>(
      `SELECT m.*, a."name" AS "activityName"
         FROM "ReadingHelpMessage" m
         JOIN "Activity" a ON a."id" = m."activityId"
        WHERE a."courseId" = $1 AND m."studentKey" = $2
        ORDER BY m."createdAt" DESC`,
      [courseId, studentKey],
    );
  }

  async listByActivity(activityId: string, limit = 200): Promise<ReadingHelpRow[]> {
    return query<ReadingHelpRow>(
      `SELECT * FROM "ReadingHelpMessage" WHERE "activityId" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
      [activityId, limit],
    );
  }
}

export const readingHelpRepository = new SqlReadingHelpRepository();
