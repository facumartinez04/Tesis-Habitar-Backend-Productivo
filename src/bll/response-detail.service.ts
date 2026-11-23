import { queryOne } from '../config/db';
import { NotFoundError } from '../utils/http-error';
import { loadQuestionResults, type StudentFeedback, type TeacherQuestionExtras } from './feedback-student.service';

export type TeacherQuestionResult = StudentFeedback['questions'][number] & TeacherQuestionExtras;

export interface TeacherResponseDetail {
  responseId: string;
  studentDisplayName: string;
  submittedAt: string;
  scores: { literal: number | null; inferencial: number | null; critico: number | null; criticoPending: boolean };
  /** Resumen de las preguntas de respuesta cerrada y de las abiertas. */
  summary: { closed: number; correct: number; partial: number; incorrect: number; open: number; openPending: number };
  questions: TeacherQuestionResult[];
}

export class ResponseDetailService {
  /** Qué respondió un alumno en cada pregunta y si está bien (para la docente). La respuesta tiene que ser de esa actividad. */
  async get(activityId: string, responseId: string): Promise<TeacherResponseDetail> {
    const response = await queryOne<{ id: string; submittedAt: Date; studentName: string }>(
      `SELECT r."id", r."submittedAt", s."name" AS "studentName"
         FROM "Response" r JOIN "Student" s ON s."id" = r."studentId"
        WHERE r."id" = $1 AND r."activityId" = $2`,
      [responseId, activityId],
    );
    if (!response) throw new NotFoundError('Respuesta no encontrada');

    const [result, questions] = await Promise.all([
      queryOne<{ literal: number | null; inferencial: number | null; critico: number | null; reviewed: boolean }>(
        `SELECT "literalScore" AS "literal", "inferencialScore" AS "inferencial", "criticoScore" AS "critico", "criticoReviewed" AS "reviewed"
           FROM "StudentResult" WHERE "responseId" = $1`,
        [response.id],
      ),
      loadQuestionResults(activityId, response.id, true),
    ]);

    const closed = questions.filter((q) => q.correct !== null);
    const open = questions.filter((q) => q.correct === null);
    return {
      responseId: response.id,
      studentDisplayName: response.studentName,
      submittedAt: response.submittedAt.toISOString(),
      scores: {
        literal: result?.literal ?? null,
        inferencial: result?.inferencial ?? null,
        critico: result?.reviewed ? (result?.critico ?? null) : null,
        criticoPending: result ? !result.reviewed : false,
      },
      summary: {
        closed: closed.length,
        correct: closed.filter((q) => q.correct).length,
        partial: closed.filter((q) => !q.correct && q.partial !== null).length,
        incorrect: closed.filter((q) => !q.correct && q.partial === null).length,
        open: open.length,
        openPending: open.filter((q) => q.pendingReview).length,
      },
      questions,
    };
  }
}

export const responseDetailService = new ResponseDetailService();
