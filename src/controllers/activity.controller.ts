import type { Request, Response } from 'express';
import { readPage } from '../utils/pagination';
import { assertCourseAccess } from '../middlewares/access.middleware';
import { activityService } from '../bll/activity.service';
import { activitySessionService } from '../bll/activity-session.service';
import { readingHelpService } from '../bll/reading-help.service';
import { activityDocumentService } from '../bll/activity-document.service';
import { studentFeedbackService } from '../bll/feedback-student.service';
import { activityTemplateService } from '../bll/activity-template.service';
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
    const { sourceText, focusAxis, language } = req.body as GenerateQuestionsDto;
    const result = await activityService.generateQuestions(sourceText, req.auth!.institutionId, focusAxis, language ?? req.locale);
    res.json(result);
  }

  async create(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateActivityDto;
    await assertCourseAccess(req, input.courseId);
    const activity = await activityService.createActivity(input);
    if (input.templateId) {
      await activityTemplateService.copyDocument(input.templateId, activity.id, req.auth!.institutionId).catch((err: Error) =>
        console.error('[activity] No se pudo copiar el documento del banco:', err.message),
      );
    }
    res.status(201).json(activity);
  }

  async getByCode(req: Request, res: Response): Promise<void> {
    const result = await activityService.getPublicByCode(String(req.params.code));
    res.json(result);
  }

  async submitResponse(req: Request, res: Response): Promise<void> {
    const input = req.body as SubmitResponseDto;
    const result = await activityService.submitResponse(String(req.params.code), input);
    res.status(201).json(result);
  }

  async studentState(req: Request, res: Response): Promise<void> {
    const { studentDisplayName, deviceId } = req.body as StudentSessionDto;
    res.json(await activitySessionService.getStudentState(String(req.params.code), studentDisplayName, deviceId));
  }

  async saveProgress(req: Request, res: Response): Promise<void> {
    res.json(await activitySessionService.saveProgress(String(req.params.code), req.body as SaveProgressDto));
  }

  async uploadDocument(req: Request, res: Response): Promise<void> {
    const meta = await activityDocumentService.upload(String(req.params.id), {
      data: req.body,
      fileName: req.header('x-file-name') ?? undefined,
      pages: req.header('x-pages') ?? undefined,
    });
    res.status(201).json(meta);
  }

  async document(req: Request, res: Response): Promise<void> {
    const doc = await activityDocumentService.forStudent(String(req.params.code));
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`);
    res.send(doc.data);
  }

  async studentFeedback(req: Request, res: Response): Promise<void> {
    const { studentDisplayName, deviceId } = req.body as StudentSessionDto;
    res.json(await studentFeedbackService.get(String(req.params.code), studentDisplayName, deviceId));
  }

  async saveTemplate(req: Request, res: Response): Promise<void> {
    res.status(201).json(await activityTemplateService.saveFromActivity(String(req.params.id), req.auth!));
  }

  async listTemplates(req: Request, res: Response): Promise<void> {
    res.json(await activityTemplateService.list(req.auth!, String(req.query.q ?? '')));
  }

  async useTemplate(req: Request, res: Response): Promise<void> {
    res.json(await activityTemplateService.use(String(req.params.templateId), req.auth!));
  }

  async deleteTemplate(req: Request, res: Response): Promise<void> {
    await activityTemplateService.remove(String(req.params.templateId), req.auth!);
    res.status(204).send();
  }

  async askHelp(req: Request, res: Response): Promise<void> {
    res.json(await readingHelpService.ask(String(req.params.code), req.body as AskHelpDto, req.locale));
  }

  async helpConversation(req: Request, res: Response): Promise<void> {
    const { studentDisplayName, deviceId } = req.body as StudentSessionDto;
    res.json(await readingHelpService.conversation(String(req.params.code), studentDisplayName, deviceId));
  }

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
