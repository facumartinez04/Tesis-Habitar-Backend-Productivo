import { withTransaction } from '../config/db';
import type { AxisScores } from '../domain/result';

export interface CreateResponseInput {
  activityId: string;
  studentId: string;
  studentDisplayName: string;
  answers: { questionId: string; selectedOption: string }[];
  scores: AxisScores;
}

export interface ResponseRepository {
  create(input: CreateResponseInput): Promise<{ responseId: string; resultId: string }>;
}

export class SqlResponseRepository implements ResponseRepository {
  async create(input: CreateResponseInput): Promise<{ responseId: string; resultId: string }> {
    return withTransaction(async (client) => {
      const { rows: responseRows } = await client.query<{ id: string }>(
        `INSERT INTO "Response" ("activityId", "studentId", "studentDisplayName")
         VALUES ($1, $2, $3)
         RETURNING "id"`,
        [input.activityId, input.studentId, input.studentDisplayName],
      );
      const responseId = responseRows[0].id;

      for (const answer of input.answers) {
        await client.query(
          `INSERT INTO "Answer" ("responseId", "questionId", "selectedOption") VALUES ($1, $2, $3)`,
          [responseId, answer.questionId, answer.selectedOption],
        );
      }

      const { rows: resultRows } = await client.query<{ id: string }>(
        `INSERT INTO "StudentResult" ("studentId", "activityId", "responseId", "literalScore", "inferencialScore", "criticoScore")
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING "id"`,
        [input.studentId, input.activityId, responseId, input.scores.literal, input.scores.inferencial, input.scores.critico],
      );

      return { responseId, resultId: resultRows[0].id };
    });
  }
}

export const responseRepository = new SqlResponseRepository();
