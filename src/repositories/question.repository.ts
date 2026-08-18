import { query } from '../config/db';
import type { Question } from '../domain/question';

interface QuestionRow {
  id: string;
  activityId: string;
  axis: Question['axis'];
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
    prompt: row.prompt,
    expectedAnswer: row.expectedAnswer,
    options: row.optionsJson ? JSON.parse(row.optionsJson) : null,
    correctOption: row.correctOption,
    edited: row.edited,
    approved: row.approved,
    order: row.order,
  };
}

export interface QuestionRepository {
  findByActivity(activityId: string): Promise<Question[]>;
  findByIds(ids: string[]): Promise<Question[]>;
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
}

export const questionRepository = new SqlQuestionRepository();
