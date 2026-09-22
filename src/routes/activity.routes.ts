import { Router } from 'express';
import { activityController } from '../controllers/activity.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { createActivitySchema, generateQuestionsSchema, submitResponseSchema } from '../dto/activity.dto';

export const activityRouter = Router();

activityRouter.post(
  '/generate-questions',
  requireAuth,
  requireRole('DOCENTE'),
  validateBody(generateQuestionsSchema),
  activityController.generateQuestions.bind(activityController),
);

activityRouter.post(
  '/',
  requireAuth,
  requireRole('DOCENTE'),
  validateBody(createActivitySchema),
  activityController.create.bind(activityController),
);

activityRouter.get(
  '/course/:courseId',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  activityController.listByCourse.bind(activityController),
);

activityRouter.get('/:code', activityController.getByCode.bind(activityController));

activityRouter.post(
  '/:code/responses',
  validateBody(submitResponseSchema),
  activityController.submitResponse.bind(activityController),
);

activityRouter.post(
  '/:id/duplicate',
  requireAuth,
  requireRole('DOCENTE'),
  activityController.duplicate.bind(activityController),
);

activityRouter.post(
  '/:id/publish',
  requireAuth,
  requireRole('DOCENTE'),
  activityController.publishNow.bind(activityController),
);
