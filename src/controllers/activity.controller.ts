import type { Request, Response } from 'express';
import { assertCourseAccess } from '../middlewares/access.middleware';
import { activityService } from '../services/activity.service';
import type { CreateActivityDto, GenerateQuestionsDto, ReviewAnswerDto, SubmitResponseDto } from '../dto/activity.dto';

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
    const activities = await activityService.listByCourse(String(req.params.courseId));
    res.json(activities);
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
