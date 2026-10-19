import { institutionRepository } from '../repositories/institution.repository';
import { questionRepository } from '../repositories/question.repository';
import { progressRepository } from '../repositories/progress.repository';
import { readingHelpRepository } from '../repositories/reading-help.repository';
import { aiQuestionGenerator } from './ai-question-generator.service';
import { aiUsageService } from './aiUsage.service';
import { openActivity, resolveStudentInActivity } from './activity-session.service';
import { pastEndTime } from './activity-window';
import { realtime } from '../realtime/realtime';
import { BadRequestError, ConflictError, UpstreamError } from '../utils/http-error';

/** Consultas por alumno y por actividad: alcanza para las palabras difíciles de un texto y acota el costo. */
export const HELP_LIMIT = 20;
const HISTORY_SENT = 6;

export interface HelpMessage {
  id: string;
  question: string;
  answer: string;
  declined: boolean;
  createdAt: string;
}

export interface HelpConversation {
  enabled: boolean;
  remaining: number;
  messages: HelpMessage[];
}

function toMessage(row: { id: string; question: string; answer: string; declined: boolean; createdAt: Date }): HelpMessage {
  return { id: row.id, question: row.question, answer: row.answer, declined: row.declined, createdAt: row.createdAt.toISOString() };
}

export class ReadingHelpService {
  /** Conversación del alumno, para mostrarla al volver a entrar. */
  async conversation(code: string, rawName: string, deviceId: string | undefined): Promise<HelpConversation> {
    const activity = await openActivity(code);
    const { identity } = await resolveStudentInActivity(activity, rawName, deviceId);
    const rows = await readingHelpRepository.listForStudent(activity.id, identity.normalized);
    return { enabled: activity.readingHelp, remaining: Math.max(0, HELP_LIMIT - rows.length), messages: rows.map(toMessage) };
  }

  /**
   * Responde una duda sobre el texto. La IA recibe el texto y las consignas de la actividad para no responderlas;
   * la duda queda registrada y el docente la ve en el panel en vivo.
   */
  async ask(
    code: string,
    input: { studentDisplayName: string; deviceId?: string; question: string },
  ): Promise<{ message: HelpMessage; remaining: number }> {
    const activity = await openActivity(code);
    if (!activity.readingHelp) throw new ConflictError('Tu docente no habilitó la ayuda con el texto en esta actividad.');
    if (pastEndTime(activity)) throw new ConflictError('[Error-REA_001] La actividad ya no está disponible');
    const question = input.question.trim().slice(0, 300);
    if (question.length < 2) throw new BadRequestError('Escribí tu duda sobre el texto.');

    const { identity, course } = await resolveStudentInActivity(activity, input.studentDisplayName, input.deviceId);
    const progress = await progressRepository.find(activity.id, identity.normalized);
    if (progress?.phase === 'ENVIADO') throw new ConflictError('Ya enviaste la actividad: la ayuda ya no está disponible.');

    const previous = await readingHelpRepository.listForStudent(activity.id, identity.normalized);
    if (previous.length >= HELP_LIMIT) {
      throw new ConflictError(`Ya usaste las ${HELP_LIMIT} consultas de esta actividad. Si tenés otra duda, preguntale a tu docente.`);
    }
    if (!activity.sourceText) throw new ConflictError('[Error-REA_001] La actividad ya no está disponible');

    const institution = await institutionRepository.findById(course.institutionId);
    const { resolveAiAccess, pseudonymize, usageCollector } = await import('./activity.service');
    const access = resolveAiAccess(institution);
    if (!access || !institution) throw new UpstreamError('La ayuda no está disponible en este momento. Preguntale a tu docente.');
    if (!access.isCustom && !(await aiUsageService.withinBudget(institution.id))) {
      throw new ConflictError('La ayuda con el texto está pausada por este mes. Si tenés una duda, preguntale a tu docente.');
    }
    const call = usageCollector(access);

    const questions = (await questionRepository.findByActivity(activity.id)).filter((q) => q.approved);
    const safeQuestion = pseudonymize(question, [identity.displayName, institution.name]);
    const provider = access.options.provider.toLowerCase();
    let result;
    try {
      result = await aiQuestionGenerator.explainText(
        {
          sourceText: activity.sourceText,
          activityQuestions: questions.map((q) => q.prompt),
          history: previous.slice(-HISTORY_SENT).map((m) => ({ question: m.question, answer: m.answer })),
          question: safeQuestion,
        },
        call.options,
      );
      await aiUsageService.record({ institutionId: institution.id, provider, success: true, wordCount: question.split(/\s+/).length, kind: 'AYUDA', ...call.usage() });
    } catch (err) {
      await aiUsageService.record({ institutionId: institution.id, provider, success: false, wordCount: 0, kind: 'AYUDA', ...call.usage() });
      console.error('[reading-help] La IA no respondió:', (err as Error).message);
      throw new UpstreamError('La ayuda no respondió. Probá de nuevo en un momento.');
    }

    const saved = await readingHelpRepository.add({
      activityId: activity.id,
      studentKey: identity.normalized,
      studentDisplayName: identity.displayName,
      question,
      answer: result.answer.trim(),
      declined: result.declined,
    });
    realtime.liveChanged(activity.id);
    return { message: toMessage(saved), remaining: Math.max(0, HELP_LIMIT - previous.length - 1) };
  }
}

export const readingHelpService = new ReadingHelpService();
