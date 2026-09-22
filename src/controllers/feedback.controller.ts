import type { Request, Response } from 'express';
import { feedbackService } from '../services/feedback.service';
import type { CreateFeedbackDto } from '../dto/feedback.dto';

export class FeedbackController {
  async listForStudent(req: Request, res: Response): Promise<void> {
    const feedback = await feedbackService.listForStudent(String(req.params.studentId));
    res.json(feedback);
  }

  async create(req: Request, res: Response): Promise<void> {
    const { message } = req.body as CreateFeedbackDto;
    const feedback = await feedbackService.create(String(req.params.studentId), req.auth!.sub, message);
    res.status(201).json(feedback);
  }
}

export const feedbackController = new FeedbackController();
