import { query, queryOne } from '../config/db';
import { activityRepository } from '../repositories/activity.repository';
import { courseRepository } from '../repositories/course.repository';
import { institutionRepository } from '../repositories/institution.repository';
import { resolveStudentIdentity } from './student-identity';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/http-error';

/** Rúbrica del eje crítico en palabras para el alumno (la misma que usa el docente al revisar). */
const RUBRIC = ['No responde o no se relaciona con la pregunta', 'Da su opinión, pero sin fundamentarla', 'Fundamenta con el texto', 'Fundamenta con el texto y lo evalúa'];

export interface StudentFeedback {
  activityName: string;
  submittedAt: string;
  scores: { literal: number | null; inferencial: number | null; critico: number | null; criticoPending: boolean };
  questions: {
    axis: string;
    prompt: string;
    /** Pregunta cerrada: opciones, la elegida y la correcta. */
    options: string[] | null;
    selectedOption: string | null;
    correctOption: string | null;
    correct: boolean | null;
    /** Pregunta abierta: lo que escribió y, si el docente ya la revisó, su puntaje de 0 a 3. */
    textAnswer: string | null;
    score: number | null;
    scoreLabel: string | null;
    pendingReview: boolean;
  }[];
}

/**
 * Devolución al alumno: cuando la actividad se cierra, ve sus respuestas corregidas. Sólo desde el celular con el
 * que respondió (el que quedó vinculado a su nombre), para que nadie vea los resultados de otro.
 */
export class StudentFeedbackService {
  async get(code: string, rawName: string, deviceId: string): Promise<StudentFeedback> {
    const activity = await activityRepository.findByCode(code);
    if (!activity) throw new NotFoundError('Actividad no encontrada');
    if (activity.status !== 'CERRADA') {
      throw new ConflictError('Vas a poder ver tus resultados cuando tu docente cierre la actividad.');
    }
    if (!activity.showFeedback) throw new ConflictError('Tu docente va a compartir los resultados en clase.');

    const course = await courseRepository.findById(activity.courseId);
    if (!course) throw new NotFoundError('Curso no encontrado');
    const institution = await institutionRepository.findById(course.institutionId);
    const identity = resolveStudentIdentity(institution?.studentIdMode ?? 'NOMBRE', rawName);
    const binding = await courseRepository.findStudentDevice(course.id, identity.normalized);
    if (!binding || binding.deviceId !== deviceId.trim()) {
      throw new ForbiddenError('Tus resultados se ven sólo desde el celular con el que respondiste.');
    }

    const response = await queryOne<{ id: string; submittedAt: Date }>(
      `SELECT r."id", r."submittedAt" FROM "Response" r JOIN "Student" s ON s."id" = r."studentId"
        WHERE r."activityId" = $1 AND s."courseId" = $2 AND s."name" = $3
        ORDER BY r."submittedAt" DESC LIMIT 1`,
      [activity.id, course.id, identity.displayName],
    );
    if (!response) throw new NotFoundError('No encontramos tus respuestas en esta actividad.');

    const [result, rows] = await Promise.all([
      queryOne<{ literal: number | null; inferencial: number | null; critico: number | null; reviewed: boolean }>(
        `SELECT "literalScore" AS "literal", "inferencialScore" AS "inferencial", "criticoScore" AS "critico", "criticoReviewed" AS "reviewed"
           FROM "StudentResult" WHERE "responseId" = $1`,
        [response.id],
      ),
      query<{
        axis: string;
        prompt: string;
        optionsJson: string | null;
        correctOption: string | null;
        selectedOption: string | null;
        textAnswer: string | null;
        teacherScore: number | null;
        reviewedAt: Date | null;
      }>(
        `SELECT q."axis", q."prompt", q."optionsJson", q."correctOption", a."selectedOption", a."textAnswer", a."teacherScore", a."reviewedAt"
           FROM "Question" q
           LEFT JOIN "Answer" a ON a."questionId" = q."id" AND a."responseId" = $2
          WHERE q."activityId" = $1 AND q."approved"
          ORDER BY q."order", q."id"`,
        [activity.id, response.id],
      ),
    ]);

    return {
      activityName: activity.name,
      submittedAt: response.submittedAt.toISOString(),
      scores: {
        literal: result?.literal ?? null,
        inferencial: result?.inferencial ?? null,
        critico: result?.reviewed ? (result?.critico ?? null) : null,
        criticoPending: result ? !result.reviewed : false,
      },
      questions: rows.map((r) => {
        const closed = Boolean(r.correctOption);
        const score = closed ? null : r.teacherScore;
        return {
          axis: r.axis,
          prompt: r.prompt,
          options: r.optionsJson ? (JSON.parse(r.optionsJson) as string[]) : null,
          selectedOption: closed ? r.selectedOption : null,
          correctOption: closed ? r.correctOption : null,
          correct: closed ? r.selectedOption === r.correctOption : null,
          textAnswer: closed ? null : r.textAnswer,
          score,
          scoreLabel: score === null || score === undefined ? null : RUBRIC[score] ?? null,
          pendingReview: !closed && Boolean(r.textAnswer) && (r.teacherScore === null || !r.reviewedAt),
        };
      }),
    };
  }
}

export const studentFeedbackService = new StudentFeedbackService();
