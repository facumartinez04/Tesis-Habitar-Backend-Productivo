import { query, queryOne } from '../config/db';
import type { CreateFeedbackInput, Feedback } from '../domain/feedback';

export interface FeedbackRepository {
  findByStudent(studentId: string): Promise<Feedback[]>;
  create(input: CreateFeedbackInput): Promise<Feedback>;
}

const SELECT = `
  SELECT f."id", f."studentId", f."authorId", u."name" AS "authorName", f."message", f."createdAt"
    FROM "Feedback" f
    JOIN "User" u ON u."id" = f."authorId"
`;

export class SqlFeedbackRepository implements FeedbackRepository {
  async findByStudent(studentId: string): Promise<Feedback[]> {
    return query<Feedback>(`${SELECT} WHERE f."studentId" = $1 ORDER BY f."createdAt" DESC`, [studentId]);
  }

  async create(input: CreateFeedbackInput): Promise<Feedback> {
    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO "Feedback" ("studentId", "authorId", "message") VALUES ($1, $2, $3) RETURNING "id"`,
      [input.studentId, input.authorId, input.message],
    );
    const row = await queryOne<Feedback>(`${SELECT} WHERE f."id" = $1`, [inserted!.id]);
    return row!;
  }
}

export const feedbackRepository = new SqlFeedbackRepository();
