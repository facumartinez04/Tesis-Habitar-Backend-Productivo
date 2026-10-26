import { query, queryOne } from '../config/db';
import type { Question } from '../domain/question';

interface QuestionRow {
  id: string;
  activityId: string;
  axis: Question['axis'];
  type: Question['type'] | null;
  correctOptionsJson: string | null;
  acceptedAnswersJson: string | null;
  prompt: string;
  expectedAnswer: string;
  optionsJson: string | null;
  correctOption: string | null;
  edited: boolean;
  approved: boolean;
  order: number;
}

function toDomain(row: QuestionRow): Question {
  return {
    id: row.id,
    activityId: row.activityId,
    axis: row.axis,
    type: row.type ?? (row.correctOption ? 'OPCION_UNICA' : 'ABIERTA'),
    prompt: row.prompt,
    expectedAnswer: row.expectedAnswer,
    options: row.optionsJson ? JSON.parse(row.optionsJson) : null,
    correctOption: row.correctOption,
    correctOptions: row.correctOptionsJson ? JSON.parse(row.correctOptionsJson) : null,
    acceptedAnswers: row.acceptedAnswersJson ? JSON.parse(row.acceptedAnswersJson) : null,
    edited: row.edited,
    approved: row.approved,
    order: row.order,
  };
}

export interface QuestionUpdate {
  type: Question['type'];
  prompt: string;
  options: string[] | null;
  correctOption: string | null;
  correctOptions: string[] | null;
  acceptedAnswers: string[] | null;
  expectedAnswer: string;
}

export interface QuestionRepository {
  findByActivity(activityId: string): Promise<Question[]>;
  findByIds(ids: string[]): Promise<Question[]>;
  update(id: string, input: QuestionUpdate): Promise<Question>;
}

export class SqlQuestionRepository implements QuestionRepository {
  async findByActivity(activityId: string): Promise<Question[]> {
    const rows = await query<QuestionRow>('SELECT * FROM "Question" WHERE "activityId" = $1 ORDER BY "order" ASC', [activityId]);
    return rows.map(toDomain);
  }

  async findByIds(ids: string[]): Promise<Question[]> {
    if (ids.length === 0) return [];
    const rows = await query<QuestionRow>('SELECT * FROM "Question" WHERE "id" = ANY($1)', [ids]);
    return rows.map(toDomain);
  }

  async update(id: string, input: QuestionUpdate): Promise<Question> {
    const row = await queryOne<QuestionRow>(
      `UPDATE "Question" SET "prompt" = $2, "optionsJson" = $3, "correctOption" = $4, "expectedAnswer" = $5, "edited" = true,
              "type" = $6, "correctOptionsJson" = $7, "acceptedAnswersJson" = $8
        WHERE "id" = $1 RETURNING *`,
      [
        id,
        input.prompt,
        input.options ? JSON.stringify(input.options) : null,
        input.correctOption,
        input.expectedAnswer,
        input.type,
        input.correctOptions?.length ? JSON.stringify(input.correctOptions) : null,
        input.acceptedAnswers?.length ? JSON.stringify(input.acceptedAnswers) : null,
      ],
    );
    if (!row) throw new Error(`Question ${id} no encontrada`);
    return toDomain(row);
  }
}

export const questionRepository = new SqlQuestionRepository();
