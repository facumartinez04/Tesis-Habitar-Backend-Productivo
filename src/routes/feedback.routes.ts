import { Router } from 'express';
import { feedbackController } from '../controllers/feedback.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { createFeedbackSchema } from '../dto/feedback.dto';

export const feedbackRouter = Router();

feedbackRouter.get(
  '/students/:studentId',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  feedbackController.listForStudent.bind(feedbackController),
);

feedbackRouter.post(
  '/students/:studentId',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  validateBody(createFeedbackSchema),
  feedbackController.create.bind(feedbackController),
);
