import { activityRepository } from '../repositories/activity.repository';
import { questionRepository } from '../repositories/question.repository';
import { criticoFromAnswers, responseRepository, type ReviewQueueItem } from '../repositories/response.repository';
import { studentRepository } from '../repositories/student.repository';
import { courseRepository } from '../repositories/course.repository';
import { countWords, isWordCountValid, TemplateQuestionGenerator } from './question-generator.service';
import { aiQuestionGenerator, type GenerateWithAiOptions } from './ai-question-generator.service';
import { institutionRepository } from '../repositories/institution.repository';
import { env } from '../config/env';
import { aiUsageService } from './aiUsage.service';
import { alertService } from './alert.service';
import { resolveStudentIdentity } from './student-identity';
import { hasClosed, hasOpened } from './activity-window';
import { BadRequestError, ConflictError, NotFoundError, UpstreamError } from '../utils/http-error';
import type { Activity, CreateActivityInput } from '../domain/activity';
import type { Question } from '../domain/question';
import type { AnswerInput, SubmitResponseInput } from '../domain/response';
import type { AxisScores } from '../domain/result';
import type { ComprehensionAxis } from '../domain/enums';
import type { Institution, StudentIdMode } from '../domain/institution';
import type { CreateAnswerInput } from '../repositories/response.repository';

type SubmitResponsePayload = Omit<SubmitResponseInput, 'activityId'>;

const MAX_OPEN_ANSWER_LENGTH = 2000;

/**
 * Puntajes del intento. Las preguntas cerradas sin responder cuentan como incorrectas (el envío automático
 * por vencimiento manda respuestas parciales). Un eje sin preguntas queda sin dato, nunca en un valor por defecto.
 * El eje crítico combina cerradas y abiertas; mientras haya abiertas sin revisar, queda pendiente.
 */
export function computeScores(
  questions: Question[],
  answers: CreateAnswerInput[],
): { scores: AxisScores; criticoReviewed: boolean } {
  const closedScore = (axis: ComprehensionAxis): number | null => {
    const gradable = questions.filter((q) => q.axis === axis && q.correctOption);
    if (gradable.length === 0) return null;
    const correct = gradable.filter((q) => answers.find((a) => a.questionId === q.id)?.selectedOption === q.correctOption);
    return Math.round((correct.length / gradable.length) * 100);
  };

  const criticoRows = questions
    .filter((q) => q.axis === 'CRITICO')
    .map((q) => {
      const answer = answers.find((a) => a.questionId === q.id);
      return {
        correctOption: q.correctOption,
        selectedOption: answer?.selectedOption ?? null,
        teacherScore: q.correctOption ? null : answer?.autoScore ?? (answer?.textAnswer ? null : 0),
      };
    });
  const critico = criticoFromAnswers(criticoRows);

  return {
    scores: { literal: closedScore('LITERAL'), inferencial: closedScore('INFERENCIAL'), critico: critico.criticoScore },
    criticoReviewed: critico.criticoReviewed,
  };
}

/** Saca de la respuesta el nombre del alumno y el de la institución antes de enviarla al proveedor de IA (§8.5). */
export function pseudonymize(text: string, names: string[]): string {
  let result = text;
  for (const name of names) {
    for (const token of name.split(/\s+/).filter((t) => t.length >= 3)) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`(?<![\\p{L}\\d])${escaped}(?![\\p{L}\\d])`, 'giu'), '[nombre]');
    }
  }
  return result;
}

interface AiAccess {
  options: GenerateWithAiOptions;
  isCustom: boolean;
}

function resolveAiAccess(institution: Institution | null): AiAccess | null {
  const provider = institution?.aiProvider ?? 'DEEPSEEK';
  const isCustom = (institution?.aiKeySource ?? 'PLATFORM') === 'CUSTOM';

  let apiKey = '';
  if (isCustom && institution?.aiCustomApiKey) {
    apiKey = institution.aiCustomApiKey;
  } else if (provider === 'OPENAI') {
    apiKey = env.openai.apiKey;
  } else {
    apiKey = env.deepseek.apiKey;
  }
  if (!apiKey) return null;

  return { options: { provider, apiKey, model: institution?.aiModel ?? undefined }, isCustom };
}

export interface GenerateQuestionsResult {
  wordCount: number;
  isValid: boolean;
  questions: Awaited<ReturnType<typeof aiQuestionGenerator.generate>>;
}

export interface SubmitResponseResult {
  responseId: string;
  resultId: string;
  scores: AxisScores;
  /** true si hay respuestas abiertas que el docente todavía tiene que revisar. */
  criticoPending: boolean;
}

/** Pregunta tal como la ve el alumno: sin la opción correcta ni la respuesta esperada. */
export type PublicQuestion = Omit<Question, 'correctOption' | 'expectedAnswer'>;

export interface PublicActivityView {
  activity: Omit<Activity, 'sourcePurgedAt'>;
  questions: PublicQuestion[];
  studentIdMode: StudentIdMode;
}

export interface ReviewQueue {
  pending: number;
  items: ReviewQueueItem[];
}

export interface ActivityService {
  generateQuestions(sourceText: string, institutionId: string, focusAxis?: ComprehensionAxis): Promise<GenerateQuestionsResult>;
  createActivity(input: CreateActivityInput): Promise<Activity>;
  getPublicByCode(code: string): Promise<PublicActivityView>;
  submitResponse(activityCode: string, input: SubmitResponsePayload): Promise<SubmitResponseResult>;
  duplicateActivity(activityId: string): Promise<Activity>;
  publishNow(activityId: string): Promise<Activity>;
  closeNow(activityId: string): Promise<Activity>;
  listByCourse(courseId: string): Promise<Activity[]>;
  listReviews(activityId: string): Promise<ReviewQueue>;
  reviewAnswer(activityId: string, answerId: string, score: number, reviewerId: string): Promise<ReviewQueue>;
}

const templateFallback = new TemplateQuestionGenerator();

export class DefaultActivityService implements ActivityService {
  async generateQuestions(
    sourceText: string,
    institutionId: string,
    focusAxis?: ComprehensionAxis,
  ): Promise<GenerateQuestionsResult> {
    const wordCount = countWords(sourceText);
    const institution = await institutionRepository.findById(institutionId);
    const access = resolveAiAccess(institution);
    const hasQuota = !access || access.isCustom ? true : await aiUsageService.hasQuotaAvailable(institutionId);

    let questions: GenerateQuestionsResult['questions'];

    if (!access || !hasQuota) {
      console.warn(
        `[activity.service] ${!access ? 'Sin clave de IA' : 'Cuota mensual agotada'} para la institución ${institutionId}: ` +
          'se usan las preguntas por plantilla.',
      );
      questions = await templateFallback.generate(sourceText, focusAxis);
    } else {
      const provider = access.options.provider.toLowerCase();
      try {
        questions = await aiQuestionGenerator.generate(sourceText, access.options, focusAxis);
        await aiUsageService.record({ institutionId, provider, success: true, wordCount, kind: 'GENERACION' });
      } catch (err) {
        if (!(err instanceof UpstreamError)) throw err;
        console.error(`[activity.service] ${provider} falló, se usan las preguntas por plantilla:`, err.message);
        questions = await templateFallback.generate(sourceText, focusAxis);
        await aiUsageService.record({ institutionId, provider, success: false, wordCount, kind: 'GENERACION' });
      }
    }

    return { wordCount, isValid: isWordCountValid(wordCount), questions };
  }

  async createActivity(input: CreateActivityInput): Promise<Activity> {
    if (input.questions.length === 0) throw new BadRequestError('La actividad necesita al menos una pregunta');
    if (!input.questions.some((q) => q.approved)) {
      throw new BadRequestError('[Error-QR_001] Debe aprobar al menos una pregunta antes de generar el código');
    }
    if (input.endTime <= input.startTime) {
      throw new BadRequestError('[Error-PAR_002] El horario de cierre debe ser posterior al de inicio');
    }
    if (hasClosed(input)) {
      throw new BadRequestError(
        'El horario de cierre seleccionado ya venció. Por favor configurá un horario futuro para que los alumnos puedan ingresar.',
      );
    }
    for (const q of input.questions) {
      if (q.correctOption && !(q.options ?? []).includes(q.correctOption)) {
        throw new BadRequestError(`La opción correcta de «${q.prompt.slice(0, 40)}» no está entre sus opciones`);
      }
    }
    return activityRepository.create(input);
  }

  /** Actualiza el estado según la ventana horaria: publica la programada y cierra la vencida, borrando su texto. */
  private async syncStatus(activity: Activity): Promise<Activity> {
    if (activity.status === 'BORRADOR') return activity;
    if (activity.status !== 'CERRADA' && hasClosed(activity)) {
      return activityRepository.closeAndPurgeText(activity.id);
    }
    if (activity.status === 'PROGRAMADA' && hasOpened(activity)) {
      return activityRepository.updateStatus(activity.id, 'PUBLICADA');
    }
    return activity;
  }

  async getPublicByCode(code: string): Promise<PublicActivityView> {
    const found = await activityRepository.findByCode(code);
    if (!found) throw new NotFoundError('Actividad no encontrada');
    const activity = await this.syncStatus(found);

    if (activity.status === 'CERRADA') throw new ConflictError('[Error-REA_001] La actividad ya no está disponible');
    if (activity.status !== 'PUBLICADA') throw new ConflictError('La actividad todavía no está disponible');

    const [questions, course] = await Promise.all([
      questionRepository.findByActivity(activity.id),
      courseRepository.findById(activity.courseId),
    ]);
    const institution = course ? await institutionRepository.findById(course.institutionId) : null;

    const { sourcePurgedAt: _purged, ...publicActivity } = activity;
    return {
      activity: publicActivity,
      questions: questions.filter((q) => q.approved).map(({ correctOption: _c, expectedAnswer: _e, ...q }) => q),
      studentIdMode: institution?.studentIdMode ?? 'LISTA',
    };
  }

  async duplicateActivity(activityId: string): Promise<Activity> {
    const original = await activityRepository.findById(activityId);
    if (!original) throw new NotFoundError('Actividad no encontrada');
    if (!original.sourceText) {
      throw new BadRequestError(
        'El texto de esta actividad se borró al cerrarse, como prevé la política de datos. Para repetirla, creá una ' +
          'actividad nueva y volvé a vincular el texto.',
      );
    }

    const questions = await questionRepository.findByActivity(activityId);

    return activityRepository.create({
      name: `${original.name} (copia)`,
      educationLevel: original.educationLevel,
      axis: original.axis,
      sourceText: original.sourceText,
      availableFrom: original.availableFrom,
      startTime: original.startTime,
      endTime: original.endTime,
      attemptPolicy: original.attemptPolicy,
      courseId: original.courseId,
      diagnosticType: null,
      status: 'BORRADOR',
      questions: questions.map((q) => ({
        axis: q.axis,
        prompt: q.prompt,
        expectedAnswer: q.expectedAnswer,
        options: q.options ?? undefined,
        correctOption: q.correctOption ?? undefined,
        approved: q.approved,
      })),
    });
  }

  async publishNow(activityId: string): Promise<Activity> {
    const activity = await activityRepository.findById(activityId);
    if (!activity) throw new NotFoundError('Actividad no encontrada');
    if (activity.status === 'CERRADA') throw new BadRequestError('No se puede publicar una actividad cerrada');
    return activityRepository.updateStatus(activityId, 'PUBLICADA');
  }

  async closeNow(activityId: string): Promise<Activity> {
    const activity = await activityRepository.findById(activityId);
    if (!activity) throw new NotFoundError('Actividad no encontrada');
    return activityRepository.closeAndPurgeText(activityId);
  }

  async listByCourse(courseId: string): Promise<Activity[]> {
    const activities = await activityRepository.findByCourse(courseId);
    return Promise.all(activities.map((a) => this.syncStatus(a)));
  }

  async submitResponse(activityCode: string, input: SubmitResponsePayload): Promise<SubmitResponseResult> {
    const found = await activityRepository.findByCode(activityCode);
    if (!found) throw new NotFoundError('Actividad no encontrada');
    // El texto se toma antes de sincronizar el estado: si la ventana vence justo ahora, la corrección igual lo necesita.
    const sourceText = found.sourceText;
    const activity = await this.syncStatus(found);

    if (activity.status === 'CERRADA') throw new ConflictError('[Error-REA_001] La actividad ya no está disponible');
    if (activity.status !== 'PUBLICADA') throw new ConflictError('La actividad todavía no está disponible');

    const course = await courseRepository.findById(activity.courseId);
    if (!course) throw new NotFoundError('Curso no encontrado');
    const institution = await institutionRepository.findById(course.institutionId);
    const identity = resolveStudentIdentity(institution?.studentIdMode ?? 'LISTA', input.studentDisplayName);

    // El dispositivo queda vinculado al alumno en el aula: nadie puede responder a nombre de otro desde otro equipo.
    const deviceId = input.deviceId?.trim();
    if (!deviceId) throw new BadRequestError('No se pudo identificar el dispositivo. Recargá la página e intentá de nuevo.');
    const binding = await courseRepository.findStudentDevice(course.id, identity.normalized);
    if (binding && binding.deviceId !== deviceId) {
      throw new ConflictError(
        `${identity.displayName} ya respondió desde otro dispositivo en esta aula. Pedile a tu docente que lo desvincule.`,
      );
    }
    if (!binding) {
      await courseRepository.bindStudentDevice({
        courseId: course.id,
        studentName: identity.displayName,
        normalizedStudentName: identity.normalized,
        deviceId,
      });
    } else {
      await courseRepository.updateDeviceLastActive(binding.id);
    }

    const student = await studentRepository.findOrCreateByName(course.id, identity.displayName);
    if (activity.attemptPolicy === 'UNICO' && (await responseRepository.countByStudent(activity.id, student.id)) > 0) {
      throw new ConflictError('Ya enviaste esta actividad. Sólo se permite un intento.');
    }

    const questions = (await questionRepository.findByActivity(activity.id)).filter((q) => q.approved);
    const answers = this.validateAnswers(questions, input.answers);
    const { scores, criticoReviewed } = computeScores(questions, answers);

    const created = await responseRepository.create({
      activityId: activity.id,
      studentId: student.id,
      studentDisplayName: identity.displayName,
      deviceId,
      answers,
      scores,
      criticoReviewed,
    });

    // La propuesta de la IA y la evaluación de alertas corren después de responderle al alumno.
    void this.afterSubmit(activity, course.id, institution, sourceText, identity.displayName, questions, created.pendingOpenAnswers);

    return { responseId: created.responseId, resultId: created.resultId, scores, criticoPending: !criticoReviewed };
  }

  private validateAnswers(questions: Question[], answers: AnswerInput[]): CreateAnswerInput[] {
    const byId = new Map(questions.map((q) => [q.id, q]));
    const result: CreateAnswerInput[] = [];
    const seen = new Set<string>();

    for (const answer of answers) {
      const question = byId.get(answer.questionId);
      if (!question) throw new BadRequestError('La respuesta corresponde a una pregunta que no es de esta actividad');
      if (seen.has(answer.questionId)) throw new BadRequestError('Hay una pregunta respondida dos veces');
      seen.add(answer.questionId);

      const isOpen = !question.correctOption && !(question.options && question.options.length > 0);
      if (isOpen) {
        const text = (answer.textAnswer ?? '').trim().slice(0, MAX_OPEN_ANSWER_LENGTH);
        result.push({ questionId: question.id, selectedOption: null, textAnswer: text || null, autoScore: text ? null : 0 });
      } else {
        const option = answer.selectedOption ?? null;
        if (option !== null && !(question.options ?? []).includes(option)) {
          throw new BadRequestError('Una de las opciones elegidas no corresponde a la pregunta');
        }
        result.push({ questionId: question.id, selectedOption: option, textAnswer: null });
      }
    }
    return result;
  }

  private async afterSubmit(
    activity: Activity,
    courseId: string,
    institution: Institution | null,
    sourceText: string | null,
    studentDisplayName: string,
    questions: Question[],
    pending: { answerId: string; questionId: string; textAnswer: string }[],
  ): Promise<void> {
    try {
      const access = resolveAiAccess(institution);
      if (access && sourceText && institution) {
        for (const item of pending) {
          const question = questions.find((q) => q.id === item.questionId);
          if (!question) continue;
          const provider = access.options.provider.toLowerCase();
          const answer = pseudonymize(item.textAnswer, [studentDisplayName, institution.name]);
          try {
            const grade = await aiQuestionGenerator.gradeOpenAnswer(
              { questionPrompt: question.prompt, expectedAnswer: question.expectedAnswer, sourceText, answer },
              access.options,
            );
            await responseRepository.setAiGrade(item.answerId, grade.score, grade.rationale);
            await aiUsageService.record({
              institutionId: institution.id,
              provider,
              success: true,
              wordCount: countWords(answer),
              kind: 'CORRECCION',
            });
          } catch (err) {
            // Sin propuesta de la IA, el docente puntúa a mano: la respuesta queda igual en la bandeja de revisión.
            console.error(`[activity.service] No se pudo proponer la corrección de ${item.answerId}:`, (err as Error).message);
            await aiUsageService.record({
              institutionId: institution.id,
              provider,
              success: false,
              wordCount: countWords(answer),
              kind: 'CORRECCION',
            });
          }
        }
      }
      await alertService.evaluateCourse(courseId);
    } catch (err) {
      console.error(`[activity.service] Error después del envío de ${activity.code}:`, (err as Error).message);
    }
  }

  async listReviews(activityId: string): Promise<ReviewQueue> {
    const activity = await activityRepository.findById(activityId);
    if (!activity) throw new NotFoundError('Actividad no encontrada');
    const items = await responseRepository.listReviewQueue(activityId);
    return { pending: items.filter((i) => i.teacherScore === null).length, items };
  }

  async reviewAnswer(activityId: string, answerId: string, score: number, reviewerId: string): Promise<ReviewQueue> {
    if (!Number.isInteger(score) || score < 0 || score > 3) throw new BadRequestError('El puntaje va de 0 a 3');
    const answer = await responseRepository.findAnswerForReview(answerId);
    if (!answer || answer.activityId !== activityId) throw new NotFoundError('Respuesta no encontrada en esta actividad');

    await responseRepository.setTeacherScore(answerId, score, reviewerId);
    await responseRepository.recomputeCritico(answer.responseId);

    const activity = await activityRepository.findById(activityId);
    if (activity) {
      await alertService.evaluateCourse(activity.courseId).catch((err: Error) =>
        console.error('[activity.service] No se pudieron evaluar las alertas:', err.message),
      );
    }
    return this.listReviews(activityId);
  }
}

export const activityService = new DefaultActivityService();
