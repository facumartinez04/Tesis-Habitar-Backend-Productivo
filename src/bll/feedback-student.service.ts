import { query, queryOne } from '../config/db';
import { activityRepository } from '../dal/activity.repository';
import { courseRepository } from '../dal/course.repository';
import { institutionRepository } from '../dal/institution.repository';
import { resolveStudentIdentity } from './student-identity';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/http-error';
import { gradeClosed, isAutoGraded } from './question-grading';
import type { QuestionType } from '../domain/question';

const RUBRIC = ['No responde o no se relaciona con la pregunta', 'Da su opinión, pero sin fundamentarla', 'Fundamenta con el texto', 'Fundamenta con el texto y lo evalúa'];

export interface StudentFeedback {
  activityName: string;
  submittedAt: string;
  scores: { literal: number | null; inferencial: number | null; critico: number | null; criticoPending: boolean };
  questions: {
    axis: string;
    type: QuestionType;
    prompt: string;
    options: string[] | null;
    selectedOption: string | null;
    selectedOptions: string[] | null;
    correctOption: string | null;
    correctOptions: string[] | null;
    acceptedAnswers: string[] | null;
    correct: boolean | null;
    partial: number | null;
    textAnswer: string | null;
    score: number | null;
    scoreLabel: string | null;
    pendingReview: boolean;
  }[];
}

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
    const binding = await courseRepository.findStudentDevice(course.id, identity.normalized, deviceId.trim());
    if (!binding) {
      throw new ForbiddenError('Tus resultados se ven sólo desde los dispositivos con los que entraste al aula.');
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
        type: QuestionType | null;
        prompt: string;
        optionsJson: string | null;
        correctOption: string | null;
        correctOptionsJson: string | null;
        acceptedAnswersJson: string | null;
        selectedOption: string | null;
        selectedOptionsJson: string | null;
        textAnswer: string | null;
        teacherScore: number | null;
        reviewedAt: Date | null;
      }>(
        `SELECT q."axis", q."type", q."prompt", q."optionsJson", q."correctOption", q."correctOptionsJson", q."acceptedAnswersJson",
                a."selectedOption", a."selectedOptionsJson", a."textAnswer", a."teacherScore", a."reviewedAt"
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
        const type: QuestionType = r.type ?? (r.correctOption ? 'OPCION_UNICA' : 'ABIERTA');
        const closed = isAutoGraded({ type });
        const options = r.optionsJson ? (JSON.parse(r.optionsJson) as string[]) : null;
        const correctOptions = r.correctOptionsJson ? (JSON.parse(r.correctOptionsJson) as string[]) : null;
        const acceptedAnswers = r.acceptedAnswersJson ? (JSON.parse(r.acceptedAnswersJson) as string[]) : null;
        const selectedOptions = r.selectedOptionsJson ? (JSON.parse(r.selectedOptionsJson) as string[]) : null;
        const fraction = closed
          ? gradeClosed(
              { type, options, correctOption: r.correctOption, correctOptions, acceptedAnswers },
              { selectedOption: r.selectedOption, selectedOptions, textAnswer: r.textAnswer },
            )
          : null;
        const score = closed ? null : r.teacherScore;
        return {
          axis: r.axis,
          type,
          prompt: r.prompt,
          options,
          selectedOption: closed ? r.selectedOption : null,
          selectedOptions: type === 'OPCION_MULTIPLE' ? selectedOptions ?? [] : null,
          correctOption: closed ? r.correctOption : null,
          correctOptions: type === 'OPCION_MULTIPLE' ? correctOptions : null,
          acceptedAnswers: type === 'COMPLETAR' ? acceptedAnswers : null,
          correct: fraction === null ? null : fraction === 1,
          partial: fraction === null || fraction === 1 || fraction === 0 ? null : Math.round(fraction * 100),
          textAnswer: type === 'ABIERTA' || type === 'COMPLETAR' ? r.textAnswer : null,
          score,
          scoreLabel: score === null || score === undefined ? null : RUBRIC[score] ?? null,
          pendingReview: !closed && Boolean(r.textAnswer) && (r.teacherScore === null || !r.reviewedAt),
        };
      }),
    };
  }
}

export const studentFeedbackService = new StudentFeedbackService();
