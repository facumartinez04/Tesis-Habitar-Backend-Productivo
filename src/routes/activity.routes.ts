import { Router } from 'express';
import { activityController } from '../controllers/activity.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { requireCourseAccess, requireActivityAccess } from '../middlewares/access.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { rateLimit } from '../middlewares/rate-limit.middleware';
import {
  createActivitySchema,
  generateQuestionsSchema,
  reviewAnswerSchema,
  submitResponseSchema,
} from '../dto/activity.dto';

export const activityRouter = Router();

// Los alumnos de un aula suelen salir a internet por la misma IP: los límites públicos contemplan un curso entero.
const publicReadLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 600, name: 'activity-read' });
const submitLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 300, name: 'activity-submit' });
const generateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 60, name: 'activity-generate' });

activityRouter.post(
  '/generate-questions',
  requireAuth,
  requireRole('DOCENTE'),
  generateLimit,
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
  requireCourseAccess('courseId'),
  activityController.listByCourse.bind(activityController),
);

// Bandeja de revisión de respuestas abiertas (mejora 0).
activityRouter.get(
  '/:id/reviews',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  requireActivityAccess('id'),
  activityController.listReviews.bind(activityController),
);

activityRouter.patch(
  '/:id/answers/:answerId/review',
  requireAuth,
  requireRole('DOCENTE'),
  requireActivityAccess('id'),
  validateBody(reviewAnswerSchema),
  activityController.reviewAnswer.bind(activityController),
);

activityRouter.get('/:code', publicReadLimit, activityController.getByCode.bind(activityController));

activityRouter.post(
  '/:code/responses',
  submitLimit,
  validateBody(submitResponseSchema),
  activityController.submitResponse.bind(activityController),
);

activityRouter.post(
  '/:id/duplicate',
  requireAuth,
  requireRole('DOCENTE'),
  requireActivityAccess('id'),
  activityController.duplicate.bind(activityController),
);

activityRouter.post(
  '/:id/publish',
  requireAuth,
  requireRole('DOCENTE'),
  requireActivityAccess('id'),
  activityController.publishNow.bind(activityController),
);

activityRouter.post(
  '/:id/close',
  requireAuth,
  requireRole('DOCENTE'),
  requireActivityAccess('id'),
  activityController.closeNow.bind(activityController),
);
