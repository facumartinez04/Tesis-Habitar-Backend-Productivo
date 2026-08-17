import type { Request, Response } from 'express';
import { courseService } from '../services/course.service';

export class CourseController {
  async listMine(req: Request, res: Response): Promise<void> {
    const { sub, role, institutionId } = req.auth!;
    const courses = await courseService.listForUser(sub, role, institutionId);
    res.json(courses);
  }
}

export const courseController = new CourseController();
