import type { Request, Response } from 'express';
import { activityService } from '../services/activity.service';
import type { CreateActivityDto, GenerateQuestionsDto, SubmitResponseDto } from '../dto/activity.dto';

export class ActivityController {
  async generateQuestions(req: Request, res: Response): Promise<void> {
    const { sourceText } = req.body as GenerateQuestionsDto;
    const result = await activityService.generateQuestions(sourceText, req.auth!.institutionId);
    res.json(result);
  }

  async create(req: Request, res: Response): Promise<void> {
    const input = req.body as CreateActivityDto;
    const activity = await activityService.createActivity(input);
    res.status(201).json(activity);
  }

  async getByCode(req: Request, res: Response): Promise<void> {
    const result = await activityService.getByCode(String(req.params.code));
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

  async listByCourse(req: Request, res: Response): Promise<void> {
    const activities = await activityService.listByCourse(String(req.params.courseId));
    res.json(activities);
  }
}

export const activityController = new ActivityController();
