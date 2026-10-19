import { query, queryOne, withTransaction } from '../config/db';
import type { AxisScores } from '../domain/result';

export interface CreateAnswerInput {
  questionId: string;
  selectedOption: string | null;
  textAnswer: string | null;
  /** Respuestas abiertas en blanco: se puntúan 0 sin pasar por la IA ni por la revisión. */
  autoScore?: number | null;
}

export interface CreateResponseInput {
  activityId: string;
  studentId: string;
  studentDisplayName: string;
  deviceId: string;
  answers: CreateAnswerInput[];
  scores: AxisScores;
  criticoReviewed: boolean;
}

export interface CreatedResponse {
  responseId: string;
  resultId: string;
  /** Respuestas abiertas que esperan la propuesta de la IA, con el id de cada una. */
  pendingOpenAnswers: { answerId: string; questionId: string; textAnswer: string }[];
}

export interface ReviewQueueItem {
  answerId: string;
  responseId: string;
  studentId: string | null;
  studentDisplayName: string;
  submittedAt: Date;
  questionId: string;
  questionPrompt: string;
  expectedAnswer: string;
  textAnswer: string | null;
  aiScore: number | null;
  aiRationale: string | null;
  teacherScore: number | null;
  reviewedAt: Date | null;
}

export interface LiveResponseRow {
  responseId: string;
  studentDisplayName: string;
  submittedAt: Date;
  literal: number | null;
  inferencial: number | null;
  critico: number | null;
  criticoReviewed: boolean;
}

export interface CriticoAnswerRow {
  correctOption: string | null;
  selectedOption: string | null;
  teacherScore: number | null;
}

export interface ResponseRepository {
  create(input: CreateResponseInput): Promise<CreatedResponse>;
  countByStudent(activityId: string, studentId: string): Promise<number>;
  setAiGrade(answerId: string, score: number, rationale: string): Promise<void>;
  listReviewQueue(activityId: string): Promise<ReviewQueueItem[]>;
  findAnswerForReview(answerId: string): Promise<{ answerId: string; responseId: string; activityId: string } | null>;
  setTeacherScore(answerId: string, score: number, reviewerId: string): Promise<void>;
  /** Recalcula el eje crítico de un intento a partir de sus respuestas críticas. */
  recomputeCritico(responseId: string): Promise<{ criticoScore: number | null; criticoReviewed: boolean }>;
  countPendingReviews(activityId: string): Promise<number>;
  listForActivity(activityId: string): Promise<LiveResponseRow[]>;
}

/**
 * Puntaje crítico de un intento, de 0 a 100: las preguntas cerradas valen 100 o 0 y las abiertas
 * teacherScore / 3. Mientras quede una abierta sin revisar, el eje queda pendiente (null).
 */
export function criticoFromAnswers(rows: CriticoAnswerRow[]): { criticoScore: number | null; criticoReviewed: boolean } {
  if (rows.length === 0) return { criticoScore: null, criticoReviewed: true };
  let total = 0;
  for (const row of rows) {
    if (row.correctOption) {
      total += row.selectedOption === row.correctOption ? 100 : 0;
    } else if (row.teacherScore === null) {
      return { criticoScore: null, criticoReviewed: false };
    } else {
      total += (row.teacherScore / 3) * 100;
    }
  }
  return { criticoScore: Math.round(total / rows.length), criticoReviewed: true };
}

export class SqlResponseRepository implements ResponseRepository {
  async create(input: CreateResponseInput): Promise<CreatedResponse> {
    return withTransaction(async (client) => {
      const { rows: responseRows } = await client.query<{ id: string }>(
        `INSERT INTO "Response" ("activityId", "studentId", "studentDisplayName", "deviceId")
         VALUES ($1, $2, $3, $4)
         RETURNING "id"`,
        [input.activityId, input.studentId, input.studentDisplayName, input.deviceId],
      );
      const responseId = responseRows[0].id;

      const pendingOpenAnswers: CreatedResponse['pendingOpenAnswers'] = [];
      for (const answer of input.answers) {
        const autoScored = answer.autoScore !== undefined && answer.autoScore !== null;
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO "Answer" ("responseId", "questionId", "selectedOption", "textAnswer", "aiScore", "aiRationale", "teacherScore", "reviewedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $5, CASE WHEN $5::int IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END)
           RETURNING "id"`,
          [
            responseId,
            answer.questionId,
            answer.selectedOption,
            answer.textAnswer,
            autoScored ? answer.autoScore : null,
            autoScored ? 'Sin respuesta.' : null,
          ],
        );
        if (answer.textAnswer && !autoScored) {
          pendingOpenAnswers.push({ answerId: rows[0].id, questionId: answer.questionId, textAnswer: answer.textAnswer });
        }
      }

      const { rows: resultRows } = await client.query<{ id: string }>(
        `INSERT INTO "StudentResult"
           ("studentId", "activityId", "responseId", "literalScore", "inferencialScore", "criticoScore", "criticoReviewed")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING "id"`,
        [
          input.studentId,
          input.activityId,
          responseId,
          input.scores.literal,
          input.scores.inferencial,
          input.scores.critico,
          input.criticoReviewed,
        ],
      );

      return { responseId, resultId: resultRows[0].id, pendingOpenAnswers };
    });
  }

  async countByStudent(activityId: string, studentId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      'SELECT COUNT(*) FROM "Response" WHERE "activityId" = $1 AND "studentId" = $2',
      [activityId, studentId],
    );
    return Number(row?.count ?? 0);
  }

  async setAiGrade(answerId: string, score: number, rationale: string): Promise<void> {
    await query('UPDATE "Answer" SET "aiScore" = $1, "aiRationale" = $2 WHERE "id" = $3', [score, rationale, answerId]);
  }

  async listReviewQueue(activityId: string): Promise<ReviewQueueItem[]> {
    return query<ReviewQueueItem>(
      `SELECT a."id" AS "answerId", r."id" AS "responseId", r."studentId", r."studentDisplayName", r."submittedAt",
              q."id" AS "questionId", q."prompt" AS "questionPrompt", q."expectedAnswer",
              a."textAnswer", a."aiScore", a."aiRationale", a."teacherScore", a."reviewedAt"
         FROM "Answer" a
         JOIN "Response" r ON r."id" = a."responseId"
         JOIN "Question" q ON q."id" = a."questionId"
        WHERE r."activityId" = $1 AND q."axis" = 'CRITICO' AND q."correctOption" IS NULL
        ORDER BY (a."teacherScore" IS NOT NULL), r."submittedAt"`,
      [activityId],
    );
  }

  async findAnswerForReview(answerId: string): Promise<{ answerId: string; responseId: string; activityId: string } | null> {
    return queryOne(
      `SELECT a."id" AS "answerId", a."responseId", r."activityId"
         FROM "Answer" a
         JOIN "Response" r ON r."id" = a."responseId"
         JOIN "Question" q ON q."id" = a."questionId"
        WHERE a."id" = $1 AND q."axis" = 'CRITICO' AND q."correctOption" IS NULL`,
      [answerId],
    );
  }

  async setTeacherScore(answerId: string, score: number, reviewerId: string): Promise<void> {
    await query(
      `UPDATE "Answer" SET "teacherScore" = $1, "reviewedAt" = CURRENT_TIMESTAMP, "reviewedById" = $2 WHERE "id" = $3`,
      [score, reviewerId, answerId],
    );
  }

  async recomputeCritico(responseId: string): Promise<{ criticoScore: number | null; criticoReviewed: boolean }> {
    const rows = await query<CriticoAnswerRow & { answerId: string | null }>(
      `SELECT q."correctOption", a."id" AS "answerId", a."selectedOption", a."teacherScore"
         FROM "Question" q
         JOIN "Response" r ON r."activityId" = q."activityId"
         LEFT JOIN "Answer" a ON a."questionId" = q."id" AND a."responseId" = r."id"
        WHERE r."id" = $1 AND q."axis" = 'CRITICO'`,
      [responseId],
    );
    // Una pregunta abierta sin respuesta guardada cuenta como no respondida (0); una cerrada, como incorrecta.
    const normalized = rows.map((row) =>
      row.answerId === null && !row.correctOption ? { ...row, teacherScore: 0 } : row,
    );
    const result = criticoFromAnswers(normalized);
    await query(
      'UPDATE "StudentResult" SET "criticoScore" = $1, "criticoReviewed" = $2 WHERE "responseId" = $3',
      [result.criticoScore, result.criticoReviewed, responseId],
    );
    return result;
  }

  async countPendingReviews(activityId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM "Answer" a
         JOIN "Response" r ON r."id" = a."responseId"
         JOIN "Question" q ON q."id" = a."questionId"
        WHERE r."activityId" = $1 AND q."axis" = 'CRITICO' AND q."correctOption" IS NULL AND a."teacherScore" IS NULL`,
      [activityId],
    );
    return Number(row?.count ?? 0);
  }

  async listForActivity(activityId: string): Promise<LiveResponseRow[]> {
    return query<LiveResponseRow>(
      `SELECT r."id" AS "responseId", r."studentDisplayName", r."submittedAt",
              sr."literalScore" AS literal, sr."inferencialScore" AS inferencial, sr."criticoScore" AS critico,
              COALESCE(sr."criticoReviewed", true) AS "criticoReviewed"
         FROM "Response" r
         LEFT JOIN "StudentResult" sr ON sr."responseId" = r."id"
        WHERE r."activityId" = $1
        ORDER BY r."submittedAt" DESC`,
      [activityId],
    );
  }

  /** Todas las respuestas de la actividad, para recalcular los puntajes si el docente corrige una pregunta. */
  async listClosedAnswers(activityId: string): Promise<
    { responseId: string; questionId: string; selectedOption: string | null; textAnswer: string | null; teacherScore: number | null }[]
  > {
    return query(
      `SELECT a."responseId", a."questionId", a."selectedOption", a."textAnswer", a."teacherScore"
         FROM "Answer" a JOIN "Response" r ON r."id" = a."responseId"
        WHERE r."activityId" = $1`,
      [activityId],
    );
  }

  async renameSelectedOption(questionId: string, before: string, after: string): Promise<void> {
    await query('UPDATE "Answer" SET "selectedOption" = $3 WHERE "questionId" = $1 AND "selectedOption" = $2', [
      questionId,
      before,
      after,
    ]);
  }

  async updateClosedScores(responseId: string, literal: number | null, inferencial: number | null): Promise<void> {
    await query('UPDATE "StudentResult" SET "literalScore" = $1, "inferencialScore" = $2 WHERE "responseId" = $3', [
      literal,
      inferencial,
      responseId,
    ]);
  }
}

export const responseRepository = new SqlResponseRepository();
