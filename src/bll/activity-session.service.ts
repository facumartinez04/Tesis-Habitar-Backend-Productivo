import { activityRepository } from '../dal/activity.repository';
import { courseRepository } from '../dal/course.repository';
import { institutionRepository } from '../dal/institution.repository';
import { questionRepository } from '../dal/question.repository';
import { responseRepository } from '../dal/response.repository';
import { studentRepository } from '../dal/student.repository';
import { progressRepository, type ProgressPhase } from '../dal/progress.repository';
import { resolveStudentIdentity, type StudentIdentity } from './student-identity';
import { pastEndTime } from './activity-window';
import { realtime } from '../realtime/realtime';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/http-error';
import type { Activity } from '../domain/activity';
import type { Course } from '../domain/course';
import type { Question } from '../domain/question';
import { linkStudentDevice, TooManyDevicesError } from './student-devices';
import { assertInstitutionActive } from './institution-pause';

export type DraftAnswers = Record<string, { selectedOption?: string; textAnswer?: string }>;

export interface StudentSessionState {
  status: 'NUEVO' | 'EN_CURSO' | 'ENVIADO';
  phase: ProgressPhase | null;
  currentIndex: number;
  answers: DraftAnswers;
  canRetry: boolean;
}

export async function openActivity(code: string): Promise<Activity> {
  const { activityService } = await import('./activity.service');
  const found = await activityRepository.findByCode(code);
  if (!found) throw new NotFoundError('Actividad no encontrada');
  const ownerCourse = await courseRepository.findById(found.courseId);
  if (ownerCourse) await assertInstitutionActive(ownerCourse.institutionId, 'student');
  const activity = await activityService.syncStatus(found);
  if (activity.status === 'CERRADA') throw new ConflictError('[Error-REA_001] La actividad ya no está disponible');
  if (activity.status !== 'PUBLICADA') throw new ConflictError('La actividad todavía no está disponible');
  return activity;
}

export async function resolveStudentInActivity(
  activity: Activity,
  rawName: string,
  rawDeviceId: string | undefined,
): Promise<{ identity: StudentIdentity; course: Course; deviceId: string }> {
  const course = await courseRepository.findById(activity.courseId);
  if (!course) throw new NotFoundError('Curso no encontrado');
  const institution = await institutionRepository.findById(course.institutionId);
  const identity = resolveStudentIdentity(institution?.studentIdMode ?? 'NOMBRE', rawName);
  const deviceId = rawDeviceId?.trim();
  if (!deviceId) throw new BadRequestError('No se pudo identificar el dispositivo. Recargá la página e intentá de nuevo.');

  try {
    await linkStudentDevice(course.id, identity, deviceId);
  } catch (err) {
    if (err instanceof TooManyDevicesError) {
      if (await progressRepository.addIntegrityEvent({
        activityId: activity.id,
        kind: 'OTRO_DISPOSITIVO',
        studentDisplayName: identity.displayName,
        otherStudent: null,
        deviceId,
      })) {
        realtime.liveChanged(activity.id);
      }
    }
    throw err;
  }

  const others = (await courseRepository.listStudentDevices(course.id)).filter(
    (d) => d.deviceId === deviceId && d.normalizedStudentName !== identity.normalized,
  );
  for (const other of others) {
    if (await progressRepository.addIntegrityEvent({
      activityId: activity.id,
      kind: 'DISPOSITIVO_COMPARTIDO',
      studentDisplayName: identity.displayName,
      otherStudent: other.studentName,
      deviceId,
    })) {
      realtime.liveChanged(activity.id);
    }
  }
  return { identity, course, deviceId };
}

export function sanitizeDraft(questions: Question[], draft: unknown): DraftAnswers {
  const result: DraftAnswers = {};
  if (!draft || typeof draft !== 'object') return result;
  const byId = new Map(questions.map((q) => [q.id, q]));
  for (const [questionId, value] of Object.entries(draft as Record<string, unknown>)) {
    const question = byId.get(questionId);
    if (!question || !value || typeof value !== 'object') continue;
    const v = value as { selectedOption?: unknown; textAnswer?: unknown };
    if (typeof v.selectedOption === 'string' && (question.options ?? []).includes(v.selectedOption)) {
      result[questionId] = { selectedOption: v.selectedOption };
    } else if (typeof v.textAnswer === 'string' && v.textAnswer.trim() && !question.correctOption) {
      result[questionId] = { textAnswer: v.textAnswer.slice(0, 2000) };
    }
  }
  return result;
}

export class ActivitySessionService {
  async getStudentState(code: string, rawName: string, deviceId: string | undefined): Promise<StudentSessionState> {
    const activity = await openActivity(code);
    if (pastEndTime(activity)) throw new ConflictError('[Error-REA_001] La actividad ya no está disponible');
    const { identity, course } = await resolveStudentInActivity(activity, rawName, deviceId);
    const progress = await progressRepository.find(activity.id, identity.normalized);
    const student = await studentRepository.findOrCreateByName(course.id, identity.displayName);
    const submitted = (await responseRepository.countByStudent(activity.id, student.id)) > 0;
    const questions = (await questionRepository.findByActivity(activity.id)).filter((q) => q.approved);

    if (submitted && progress?.phase !== 'RESPONDIENDO' && progress?.phase !== 'LEYENDO') {
      return { status: 'ENVIADO', phase: 'ENVIADO', currentIndex: 0, answers: {}, canRetry: activity.attemptPolicy === 'REINTENTOS' };
    }
    if (!progress) return { status: 'NUEVO', phase: null, currentIndex: 0, answers: {}, canRetry: false };
    return {
      status: 'EN_CURSO',
      phase: progress.phase,
      currentIndex: Math.min(progress.currentIndex, Math.max(questions.length - 1, 0)),
      answers: sanitizeDraft(questions, progress.draftJson ? JSON.parse(progress.draftJson) : null),
      canRetry: false,
    };
  }

  async saveProgress(
    code: string,
    input: { studentDisplayName: string; deviceId?: string; phase: 'LEYENDO' | 'RESPONDIENDO'; currentIndex: number; answers: unknown; retry?: boolean },
  ): Promise<{ ok: true }> {
    const activity = await openActivity(code);
    const { identity } = await resolveStudentInActivity(activity, input.studentDisplayName, input.deviceId);
    const existing = await progressRepository.find(activity.id, identity.normalized);
    if (existing?.phase === 'ENVIADO') {
      if (!(input.retry && activity.attemptPolicy === 'REINTENTOS')) {
        throw new ConflictError('Ya completaste esta actividad.');
      }
      await progressRepository.reopen(activity.id, identity.normalized);
    }
    const phase =
      input.phase === 'RESPONDIENDO' && activity.readingMode === 'DOCENTE_HABILITA' && !activity.questionsReleasedAt
        ? 'LEYENDO'
        : input.phase;
    const questions = (await questionRepository.findByActivity(activity.id)).filter((q) => q.approved);
    const draft = sanitizeDraft(questions, input.answers);
    await progressRepository.upsert({
      activityId: activity.id,
      studentKey: identity.normalized,
      studentDisplayName: identity.displayName,
      deviceId: input.deviceId!.trim(),
      phase,
      currentIndex: Math.max(0, Math.min(Number(input.currentIndex) || 0, Math.max(questions.length - 1, 0))),
      answeredCount: Object.keys(draft).length,
      draftJson: JSON.stringify(draft),
    });
    realtime.liveChanged(activity.id);
    return { ok: true };
  }

  async releaseQuestions(activityId: string): Promise<Activity> {
    const activity = await activityRepository.findById(activityId);
    if (!activity) throw new NotFoundError('Actividad no encontrada');
    if (activity.status === 'CERRADA') throw new BadRequestError('La actividad ya está cerrada');
    const updated = await activityRepository.releaseQuestions(activityId);
    realtime.questionsReleased(updated);
    return updated;
  }

  async editQuestion(
    activityId: string,
    questionId: string,
    input: { prompt?: string; options?: string[]; correctOption?: string; expectedAnswer?: string },
  ): Promise<Question> {
    const questions = await questionRepository.findByActivity(activityId);
    const question = questions.find((q) => q.id === questionId);
    if (!question) throw new NotFoundError('Pregunta no encontrada en esta actividad');
    const isClosed = Boolean(question.correctOption);
    const options = isClosed ? (input.options ?? question.options ?? []).map((o) => o.trim()).filter(Boolean) : null;
    const correctOption = isClosed ? (input.correctOption ?? question.correctOption)!.trim() : null;
    if (isClosed) {
      if (!options || options.length < 2) throw new BadRequestError('La pregunta necesita al menos dos opciones');
      if (new Set(options).size !== options.length) throw new BadRequestError('Hay opciones repetidas');
      if (!correctOption || !options.includes(correctOption)) throw new BadRequestError('La opción correcta tiene que estar entre las opciones');
    }
    const prompt = (input.prompt ?? question.prompt).trim();
    if (prompt.length < 3) throw new BadRequestError('La consigna es demasiado corta');
    if (isClosed && options && question.options) {
      for (let i = 0; i < question.options.length; i++) {
        const before = question.options[i];
        const after = options[i];
        if (after && before !== after && !question.options.includes(after)) {
          await responseRepository.renameSelectedOption(questionId, before, after);
        }
      }
    }
    const updated = await questionRepository.update(questionId, {
      prompt,
      options,
      correctOption,
      expectedAnswer: (input.expectedAnswer ?? question.expectedAnswer).trim() || question.expectedAnswer,
    });
    await this.rescore(activityId);
    const activity = await activityRepository.findById(activityId);
    if (activity) realtime.questionsUpdated(activity);
    return updated;
  }

  private async rescore(activityId: string): Promise<void> {
    const { computeScores } = await import('./activity.service');
    const questions = (await questionRepository.findByActivity(activityId)).filter((q) => q.approved);
    const answers = await responseRepository.listClosedAnswers(activityId);
    const byResponse = new Map<string, { questionId: string; selectedOption: string | null; textAnswer: string | null; autoScore?: number | null }[]>();
    for (const a of answers) {
      const list = byResponse.get(a.responseId) ?? [];
      list.push({ questionId: a.questionId, selectedOption: a.selectedOption, textAnswer: a.textAnswer, autoScore: a.teacherScore });
      byResponse.set(a.responseId, list);
    }
    for (const [responseId, list] of byResponse) {
      const { scores } = computeScores(questions, list);
      await responseRepository.updateClosedScores(responseId, scores.literal, scores.inferencial);
      await responseRepository.recomputeCritico(responseId);
    }
    realtime.liveChanged(activityId);
  }

  async markSubmitted(input: {
    activityId: string;
    studentKey: string;
    studentDisplayName: string;
    deviceId: string;
    answeredCount: number;
  }): Promise<void> {
    await progressRepository.markSubmitted(input);
  }
}

export const activitySessionService = new ActivitySessionService();
