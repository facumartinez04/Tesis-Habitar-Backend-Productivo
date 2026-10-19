import express, { Router } from 'express';
import { activityController } from '../controllers/activity.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { requireCourseAccess, requireActivityAccess } from '../middlewares/access.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { rateLimit } from '../middlewares/rate-limit.middleware';
import {
  askHelpSchema,
  createActivitySchema,
  editQuestionSchema,
  generateQuestionsSchema,
  reviewAnswerSchema,
  saveProgressSchema,
  studentSessionSchema,
  submitResponseSchema,
} from '../dto/activity.dto';

export const activityRouter = Router();

// Los alumnos de un aula suelen salir a internet por la misma IP: los límites públicos contemplan un curso entero.
const publicReadLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 600, name: 'activity-read' });
const submitLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 300, name: 'activity-submit' });
const generateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 60, name: 'activity-generate' });
// Cada alumno reporta su avance al cambiar de pregunta o de respuesta (con pausa): un curso de 40 entra holgado.
// Ayuda con el texto: el límite fino es por alumno (20 por actividad); éste cubre a un curso entero detrás de una IP.
const helpLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 800, name: 'activity-help' });
const progressLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 4000, name: 'activity-progress' });

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

// Panel en vivo de la actividad: estado, ventana y respuestas que van llegando.
activityRouter.get(
  '/:id/live',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  requireActivityAccess('id'),
  activityController.live.bind(activityController),
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

// Estado del alumno en la actividad (POST para no dejar el nombre en la URL).
activityRouter.post(
  '/:code/me',
  publicReadLimit,
  validateBody(studentSessionSchema),
  activityController.studentState.bind(activityController),
);

// Documento original: el docente lo sube como binario (hasta 15 MB); el alumno lo pide para leerlo.
activityRouter.post(
  '/:id/document',
  requireAuth,
  requireRole('DOCENTE'),
  requireActivityAccess('id'),
  express.raw({ type: () => true, limit: '15mb' }),
  activityController.uploadDocument.bind(activityController),
);
activityRouter.get('/:code/document', publicReadLimit, activityController.document.bind(activityController));

activityRouter.post('/:code/help', helpLimit, validateBody(askHelpSchema), activityController.askHelp.bind(activityController));

activityRouter.post(
  '/:code/help/history',
  publicReadLimit,
  validateBody(studentSessionSchema),
  activityController.helpConversation.bind(activityController),
);

activityRouter.post(
  '/:code/progress',
  progressLimit,
  validateBody(saveProgressSchema),
  activityController.saveProgress.bind(activityController),
);

activityRouter.post(
  '/:id/release',
  requireAuth,
  requireRole('DOCENTE'),
  requireActivityAccess('id'),
  activityController.releaseQuestions.bind(activityController),
);

activityRouter.patch(
  '/:id/questions/:questionId',
  requireAuth,
  requireRole('DOCENTE'),
  requireActivityAccess('id'),
  validateBody(editQuestionSchema),
  activityController.editQuestion.bind(activityController),
);

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
