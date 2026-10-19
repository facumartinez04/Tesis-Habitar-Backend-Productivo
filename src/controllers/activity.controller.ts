import type { Request, Response } from 'express';
import { readPage } from '../utils/pagination';
import { assertCourseAccess } from '../middlewares/access.middleware';
import { activityService } from '../services/activity.service';
import { activitySessionService } from '../services/activity-session.service';
import { readingHelpService } from '../services/reading-help.service';
import type {
  AskHelpDto,
  CreateActivityDto,
  EditQuestionDto,
  GenerateQuestionsDto,
  ReviewAnswerDto,
  SaveProgressDto,
  StudentSessionDto,
  SubmitResponseDto,
} from '../dto/activity.dto';

export class ActivityController {
  async generateQuestions(req: Request, res: Response): Promise<void> {
    const { sourceText, focusAxis } = req.body as GenerateQuestionsDto;
    const result = await activityService.generateQuestions(sourceText, req.auth!.institutionId, focusAxis);
    res.json(result);
  }

  async create(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateActivityDto;
    await assertCourseAccess(req, input.courseId);
    const activity = await activityService.createActivity(input);
    res.status(201).json(activity);
  }

  /** Vista pública del alumno: sin opciones correctas ni respuestas esperadas. */
  async getByCode(req: Request, res: Response): Promise<void> {
    const result = await activityService.getPublicByCode(String(req.params.code));
    res.json(result);
  }

  async submitResponse(req: Request, res: Response): Promise<void> {
    const input = req.body as SubmitResponseDto;
    const result = await activityService.submitResponse(String(req.params.code), input);
    res.status(201).json(result);
  }

  /** Estado del alumno al entrar: si ya envió, no puede volver a empezar; si tenía un borrador, lo retoma. */
  async studentState(req: Request, res: Response): Promise<void> {
    const { studentDisplayName, deviceId } = req.body as StudentSessionDto;
    res.json(await activitySessionService.getStudentState(String(req.params.code), studentDisplayName, deviceId));
  }

  async saveProgress(req: Request, res: Response): Promise<void> {
    res.json(await activitySessionService.saveProgress(String(req.params.code), req.body as SaveProgressDto));
  }

  /** Duda del alumno sobre el texto: la IA explica sin responder la actividad. */
  async askHelp(req: Request, res: Response): Promise<void> {
    res.json(await readingHelpService.ask(String(req.params.code), req.body as AskHelpDto));
  }

  async helpConversation(req: Request, res: Response): Promise<void> {
    const { studentDisplayName, deviceId } = req.body as StudentSessionDto;
    res.json(await readingHelpService.conversation(String(req.params.code), studentDisplayName, deviceId));
  }

  /** El docente pasa a todos a las preguntas. */
  async releaseQuestions(req: Request, res: Response): Promise<void> {
    res.json(await activitySessionService.releaseQuestions(String(req.params.id)));
  }

  async editQuestion(req: Request, res: Response): Promise<void> {
    const question = await activitySessionService.editQuestion(
      String(req.params.id),
      String(req.params.questionId),
      req.body as EditQuestionDto,
    );
    res.json(question);
  }

  async duplicate(req: Request, res: Response): Promise<void> {
    const activity = await activityService.duplicateActivity(String(req.params.id));
    res.status(201).json(activity);
  }

  async publishNow(req: Request, res: Response): Promise<void> {
    const activity = await activityService.publishNow(String(req.params.id));
    res.json(activity);
  }

  async closeNow(req: Request, res: Response): Promise<void> {
    const activity = await activityService.closeNow(String(req.params.id));
    res.json(activity);
  }

  async listByCourse(req: Request, res: Response): Promise<void> {
    const page = readPage(req);
    const courseId = String(req.params.courseId);
    res.json(page ? await activityService.listByCoursePage(courseId, page) : await activityService.listByCourse(courseId));
  }

  async live(req: Request, res: Response): Promise<void> {
    res.json(await activityService.getLive(String(req.params.id)));
  }

  async listReviews(req: Request, res: Response): Promise<void> {
    const queue = await activityService.listReviews(String(req.params.id));
    res.json(queue);
  }

  async reviewAnswer(req: Request, res: Response): Promise<void> {
    const { score } = req.body as ReviewAnswerDto;
    const queue = await activityService.reviewAnswer(
      String(req.params.id),
      String(req.params.answerId),
      score,
      req.auth!.sub,
    );
    res.json(queue);
  }
}

export const activityController = new ActivityController();
