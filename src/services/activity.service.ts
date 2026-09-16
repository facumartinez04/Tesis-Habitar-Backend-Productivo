import { activityRepository } from '../repositories/activity.repository';
import { questionRepository } from '../repositories/question.repository';
import { responseRepository } from '../repositories/response.repository';
import { studentRepository } from '../repositories/student.repository';
import { countWords, isWordCountValid, TemplateQuestionGenerator } from './question-generator.service';
import { aiQuestionGenerator } from './ai-question-generator.service';
import { institutionRepository } from '../repositories/institution.repository';
import { env } from '../config/env';
import { aiUsageService } from './aiUsage.service';
import { UpstreamError } from '../utils/http-error';
import { BadRequestError, NotFoundError } from '../utils/http-error';
import type { Activity, CreateActivityInput } from '../domain/activity';
import type { Question } from '../domain/question';
import type { AnswerInput, SubmitResponseInput } from '../domain/response';
import type { AxisScores } from '../domain/result';
import type { ComprehensionAxis } from '../domain/enums';

type SubmitResponsePayload = Omit<SubmitResponseInput, 'activityId'>;

const axisKeys: Record<ComprehensionAxis, keyof AxisScores> = {
  LITERAL: 'literal',
  INFERENCIAL: 'inferencial',
  CRITICO: 'critico',
};

function computeScores(questions: Question[], answers: AnswerInput[]): AxisScores {
  const scores = { literal: 50, inferencial: 50, critico: 50 };

  (Object.keys(axisKeys) as ComprehensionAxis[]).forEach((axis) => {
    const gradable = questions.filter((q) => q.axis === axis && q.correctOption);
    if (gradable.length === 0) return;

    let correct = 0;
    let total = 0;
    gradable.forEach((question) => {
      const answer = answers.find((a) => a.questionId === question.id);
      if (!answer) return;
      total += 1;
      if (answer.selectedOption === question.correctOption) correct += 1;
    });

    if (total > 0) {
      scores[axisKeys[axis]] = Math.round((correct / total) * 100);
    }
  });

  return scores;
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
}

export interface ActivityService {
  generateQuestions(sourceText: string, institutionId: string): Promise<GenerateQuestionsResult>;
  createActivity(input: CreateActivityInput): Promise<Activity>;
  getByCode(code: string): Promise<{ activity: Activity; questions: Question[]; responsesCount: number }>;
  submitResponse(activityCode: string, input: SubmitResponsePayload): Promise<SubmitResponseResult>;
  duplicateActivity(activityId: string): Promise<Activity>;
  publishNow(activityId: string): Promise<Activity>;
  listByCourse(courseId: string): Promise<Activity[]>;
}

const templateFallback = new TemplateQuestionGenerator();

export class DefaultActivityService implements ActivityService {
  async generateQuestions(sourceText: string, institutionId: string): Promise<GenerateQuestionsResult> {
    const wordCount = countWords(sourceText);
    const institution = await institutionRepository.findById(institutionId);

    const provider = institution?.aiProvider ?? 'DEEPSEEK';
    const keySource = institution?.aiKeySource ?? 'PLATFORM';
    const isCustom = keySource === 'CUSTOM';

    let apiKey = '';
    if (isCustom && institution?.aiCustomApiKey) {
      apiKey = institution.aiCustomApiKey;
    } else if (provider === 'OPENAI') {
      apiKey = env.openai.apiKey;
    } else {
      apiKey = env.deepseek.apiKey;
    }

    let hasQuota = true;
    if (!isCustom) {
      hasQuota = await aiUsageService.hasQuotaAvailable(institutionId);
    }

    let questions: GenerateQuestionsResult['questions'];
    let usedRealAi = false;

    if (!apiKey || !hasQuota) {
      if (!apiKey) {
        console.warn(`[activity.service] Sin API key para ${provider} (institución ${institutionId}): usando fallback por plantillas.`);
      } else {
        console.warn(`[activity.service] Cuota mensual agotada para institución ${institutionId}: usando fallback por plantillas.`);
      }
      questions = await templateFallback.generate(sourceText);
    } else {
      try {
        questions = await aiQuestionGenerator.generate(sourceText, {
          provider,
          apiKey,
          model: institution?.aiModel ?? undefined,
        });
        usedRealAi = true;
      } catch (err) {
        if (err instanceof UpstreamError) {
          console.error(`[activity.service] ${provider} falló, usando fallback por plantillas:`, err.message);
          questions = await templateFallback.generate(sourceText);
          await aiUsageService.record({ institutionId, provider: provider.toLowerCase(), success: false, wordCount });
        } else {
          throw err;
        }
      }
    }

    if (usedRealAi) {
      await aiUsageService.record({ institutionId, provider: provider.toLowerCase(), success: true, wordCount });
    }

    return {
      wordCount,
      isValid: isWordCountValid(wordCount),
      questions,
    };
  }

  async createActivity(input: CreateActivityInput): Promise<Activity> {
    if (input.questions.length === 0) throw new BadRequestError('La actividad necesita al menos una pregunta');
    return activityRepository.create(input);
  }

  async getByCode(code: string): Promise<{ activity: Activity; questions: Question[]; responsesCount: number }> {
    let activity = await activityRepository.findByCode(code);
    if (!activity) throw new NotFoundError('Actividad no encontrada');

    activity = await this.promoteIfScheduled(activity);

    const [questions, responsesCount] = await Promise.all([
      questionRepository.findByActivity(activity.id),
      activityRepository.countResponses(activity.id),
    ]);

    return { activity, questions, responsesCount };
  }

  private async promoteIfScheduled(activity: Activity): Promise<Activity> {
    if (activity.status !== 'PROGRAMADA') return activity;

    const scheduledFor = new Date(activity.availableFrom);
    if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() > Date.now()) return activity;

    return activityRepository.updateStatus(activity.id, 'PUBLICADA');
  }

  async duplicateActivity(activityId: string): Promise<Activity> {
    const original = await activityRepository.findById(activityId);
    if (!original) throw new NotFoundError('Actividad no encontrada');

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

  async listByCourse(courseId: string): Promise<Activity[]> {
    const activities = await activityRepository.findByCourse(courseId);
    return Promise.all(activities.map((a) => this.promoteIfScheduled(a)));
  }

  async submitResponse(activityCode: string, input: SubmitResponsePayload): Promise<SubmitResponseResult> {
    const activity = await activityRepository.findByCode(activityCode);
    if (!activity) throw new NotFoundError('Actividad no encontrada');

    const questions = await questionRepository.findByActivity(activity.id);
    const student = await studentRepository.findOrCreateByName(activity.courseId, input.studentDisplayName);
    const scores = computeScores(questions, input.answers);

    const { responseId, resultId } = await responseRepository.create({
      activityId: activity.id,
      studentId: student.id,
      studentDisplayName: input.studentDisplayName,
      answers: input.answers,
      scores,
    });

    return { responseId, resultId, scores };
  }
}

export const activityService = new DefaultActivityService();
