import { activityRepository } from '../repositories/activity.repository';
import { activitySessionService, resolveStudentInActivity } from './activity-session.service';
import { progressRepository } from '../repositories/progress.repository';
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
import { activityWindow, hasClosed, hasOpened, pastEndTime, SUBMIT_GRACE_MS } from './activity-window';
import { realtime } from '../realtime/realtime';
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

/** Lo que recibe el alumno al enviar: sólo la confirmación. Los puntajes los ve el docente. */
export interface SubmitResponseResult {
  responseId: string;
  submittedAt: string;
}

/** Pregunta tal como la ve el alumno: sin la opción correcta ni la respuesta esperada. */
export type PublicQuestion = Omit<Question, 'correctOption' | 'expectedAnswer'>;

export interface PublicActivityView {
  activity: Omit<Activity, 'sourcePurgedAt'>;
  /** Vacío mientras el docente no habilite las preguntas (modo «el docente habilita»). */
  questions: PublicQuestion[];
  questionCount: number;
  /** true si el alumno ya puede pasar a las preguntas. */
  questionsReleased: boolean;
  studentIdMode: StudentIdMode;
}

export interface LiveActivityView {
  id: string;
  code: string;
  name: string;
  status: Activity['status'];
  attemptPolicy: Activity['attemptPolicy'];
  diagnosticType: Activity['diagnosticType'];
  availableFrom: string;
  startTime: string;
  endDate: string;
  endTime: string;
  opensAt: string | null;
  closesAt: string | null;
  courseId: string;
  courseName: string;
  courseQrCode: string | null;
  questionCount: number;
  devicesInClassroom: number;
  pendingReviews: number;
  readingMode: Activity['readingMode'];
  questionsReleasedAt: string | null;
  /** Avance de cada alumno, en vivo. */
  students: {
    studentDisplayName: string;
    phase: 'LEYENDO' | 'RESPONDIENDO' | 'ENVIADO';
    currentIndex: number;
    answeredCount: number;
    startedAt: string;
    updatedAt: string;
    /** Últimos 4 caracteres del dispositivo, para distinguir celulares sin exponer el identificador. */
    deviceTag: string;
  }[];
  /** Posible suplantación (mismo alumno desde otro celular) o un celular que responde por varios alumnos. */
  integrityEvents: {
    id: string;
    kind: 'OTRO_DISPOSITIVO' | 'DISPOSITIVO_COMPARTIDO';
    studentDisplayName: string;
    otherStudent: string | null;
    createdAt: string;
  }[];
  questions: {
    id: string;
    axis: Question['axis'];
    prompt: string;
    options: string[] | null;
    correctOption: string | null;
    expectedAnswer: string;
  }[];
  responses: {
    responseId: string;
    studentDisplayName: string;
    submittedAt: string;
    scores: AxisScores;
    criticoPending: boolean;
  }[];
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
  syncStatus(activity: Activity): Promise<Activity>;
  currentForCourse(courseId: string): Promise<{ open: Activity | null; upcoming: Activity | null }>;
  getLive(activityId: string): Promise<LiveActivityView>;
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
    const { opensAt, closesAt } = activityWindow(input);
    if (!opensAt || !closesAt || closesAt.getTime() <= opensAt.getTime()) {
      throw new BadRequestError('[Error-PAR_002] El cierre debe ser posterior a la apertura');
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
    // Hasta la hora de inicio queda programada; el reloj la abre sola y avisa al aula en tiempo real.
    const created = await activityRepository.create({
      ...input,
      status: input.status ?? (hasOpened(input) ? 'PUBLICADA' : 'PROGRAMADA'),
    });
    realtime.activityChanged(created);
    return created;
  }

  /**
   * Actualiza el estado según la ventana horaria: publica la programada y cierra la vencida, borrando su texto.
   * Si cambió, avisa en tiempo real al aula, al alumno y al panel del docente.
   */
  async syncStatus(activity: Activity): Promise<Activity> {
    if (activity.status === 'BORRADOR') return activity;
    let updated = activity;
    if (activity.status !== 'CERRADA' && hasClosed(activity)) {
      updated = await activityRepository.closeAndPurgeText(activity.id);
    } else if (activity.status === 'PROGRAMADA' && hasOpened(activity)) {
      updated = await activityRepository.updateStatus(activity.id, 'PUBLICADA');
    }
    if (updated.status !== activity.status) realtime.activityChanged(updated);
    return updated;
  }

  /** Actividad que el aula le ofrece al alumno: la abierta más reciente o, si no hay, la próxima programada. */
  async currentForCourse(courseId: string): Promise<{ open: Activity | null; upcoming: Activity | null }> {
    const candidates = await Promise.all(
      (await activityRepository.findOpenOrScheduledByCourse(courseId)).map((a) => this.syncStatus(a)),
    );
    const open = candidates.find((a) => a.status === 'PUBLICADA' && !pastEndTime(a)) ?? null;
    const upcoming = open ? null : candidates.find((a) => a.status === 'PROGRAMADA') ?? null;
    return { open, upcoming };
  }

  /** Estado en vivo para el panel del docente: ventana, respuestas que van llegando y revisiones pendientes. */
  async getLive(activityId: string): Promise<LiveActivityView> {
    const found = await activityRepository.findById(activityId);
    if (!found) throw new NotFoundError('Actividad no encontrada');
    const activity = await this.syncStatus(found);
    const course = await courseRepository.findById(activity.courseId);
    const [responses, devices, pendingReviews, questions, progress, integrity] = await Promise.all([
      responseRepository.listForActivity(activityId),
      course ? courseRepository.listStudentDevices(course.id) : Promise.resolve([]),
      responseRepository.countPendingReviews(activityId),
      questionRepository.findByActivity(activityId),
      progressRepository.listByActivity(activityId),
      progressRepository.listIntegrityEvents(activityId),
    ]);
    const approved = questions.filter((q) => q.approved);
    const { opensAt, closesAt } = activityWindow(activity);
    return {
      id: activity.id,
      code: activity.code,
      name: activity.name,
      status: activity.status,
      attemptPolicy: activity.attemptPolicy,
      diagnosticType: activity.diagnosticType,
      availableFrom: activity.availableFrom,
      startTime: activity.startTime,
      endDate: activity.endDate ?? activity.availableFrom,
      endTime: activity.endTime,
      opensAt: opensAt?.toISOString() ?? null,
      closesAt: closesAt?.toISOString() ?? null,
      courseId: activity.courseId,
      courseName: course?.name ?? '',
      courseQrCode: course?.qrCode ?? null,
      questionCount: approved.length,
      devicesInClassroom: devices.length,
      pendingReviews,
      readingMode: activity.readingMode,
      questionsReleasedAt: activity.questionsReleasedAt?.toISOString() ?? null,
      students: progress.map((p) => ({
        studentDisplayName: p.studentDisplayName,
        phase: p.phase,
        currentIndex: p.currentIndex,
        answeredCount: p.answeredCount,
        startedAt: p.startedAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        deviceTag: p.deviceId.slice(-4).toUpperCase(),
      })),
      integrityEvents: integrity.map((e) => ({
        id: e.id,
        kind: e.kind,
        studentDisplayName: e.studentDisplayName,
        otherStudent: e.otherStudent,
        createdAt: e.createdAt.toISOString(),
      })),
      questions: approved.map((q) => ({
        id: q.id,
        axis: q.axis,
        prompt: q.prompt,
        options: q.options ?? null,
        correctOption: q.correctOption ?? null,
        expectedAnswer: q.expectedAnswer,
      })),
      responses: responses.map((r) => ({
        responseId: r.responseId,
        studentDisplayName: r.studentDisplayName,
        submittedAt: r.submittedAt.toISOString(),
        scores: { literal: r.literal, inferencial: r.inferencial, critico: r.critico },
        criticoPending: !r.criticoReviewed,
      })),
    };
  }

  async getPublicByCode(code: string): Promise<PublicActivityView> {
    const found = await activityRepository.findByCode(code);
    if (!found) throw new NotFoundError('Actividad no encontrada');
    const activity = await this.syncStatus(found);

    // Pasada la hora de cierre ya no se puede empezar; la tolerancia es sólo para los envíos finales.
    if (activity.status === 'CERRADA' || pastEndTime(activity)) {
      throw new ConflictError('[Error-REA_001] La actividad ya no está disponible');
    }
    if (activity.status !== 'PUBLICADA') throw new ConflictError('La actividad todavía no está disponible');

    const [questions, course] = await Promise.all([
      questionRepository.findByActivity(activity.id),
      courseRepository.findById(activity.courseId),
    ]);
    const institution = course ? await institutionRepository.findById(course.institutionId) : null;

    const { sourcePurgedAt: _purged, ...publicActivity } = activity;
    const approved = questions.filter((q) => q.approved);
    // Con «el docente habilita», las preguntas ni siquiera viajan al celular hasta que el docente las libera.
    const questionsReleased = activity.readingMode !== 'DOCENTE_HABILITA' || Boolean(activity.questionsReleasedAt);
    return {
      activity: publicActivity,
      questions: questionsReleased ? approved.map(({ correctOption: _c, expectedAnswer: _e, ...q }) => q) : [],
      questionCount: approved.length,
      questionsReleased,
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
      endDate: original.endDate,
      endTime: original.endTime,
      attemptPolicy: original.attemptPolicy,
      courseId: original.courseId,
      diagnosticType: null,
      readingMode: original.readingMode,
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
    const updated = await activityRepository.updateStatus(activityId, 'PUBLICADA');
    realtime.activityChanged(updated);
    return updated;
  }

  async closeNow(activityId: string): Promise<Activity> {
    const activity = await activityRepository.findById(activityId);
    if (!activity) throw new NotFoundError('Actividad no encontrada');
    const updated = await activityRepository.closeAndPurgeText(activityId);
    realtime.activityChanged(updated);
    return updated;
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

    if (activity.status !== 'PUBLICADA' && activity.status !== 'CERRADA') {
      throw new ConflictError('La actividad todavía no está disponible');
    }

    // El dispositivo queda vinculado al alumno en el aula: nadie puede responder a nombre de otro desde otro equipo,
    // y el intento queda registrado en el panel del docente como posible suplantación.
    const { identity, course, deviceId } = await resolveStudentInActivity(activity, input.studentDisplayName, input.deviceId);
    const institution = await institutionRepository.findById(course.institutionId);

    // Si el docente la cerró mientras el alumno respondía, todavía se recibe lo que tenía (envío automático), pero
    // sólo de quien ya estaba adentro y dentro de la tolerancia. Nadie nuevo puede entrar a una actividad cerrada.
    if (activity.status === 'CERRADA') {
      const progress = await progressRepository.find(activity.id, identity.normalized);
      const wasInside = progress !== null && progress.phase !== 'ENVIADO';
      if (!wasInside || !(await activityRepository.closedWithin(activity.id, SUBMIT_GRACE_MS))) {
        throw new ConflictError('[Error-REA_001] La actividad ya no está disponible');
      }
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
    await activitySessionService.markSubmitted({
      activityId: activity.id,
      studentKey: identity.normalized,
      studentDisplayName: identity.displayName,
      deviceId,
      answeredCount: answers.filter((a) => a.selectedOption || a.textAnswer).length,
    });

    realtime.liveChanged(activity.id);
    // La propuesta de la IA y la evaluación de alertas corren después de responderle al alumno.
    void this.afterSubmit(activity, course.id, institution, sourceText, identity.displayName, questions, created.pendingOpenAnswers);

    return { responseId: created.responseId, submittedAt: new Date().toISOString() };
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
            realtime.liveChanged(activity.id);
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
    realtime.liveChanged(activityId);

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
