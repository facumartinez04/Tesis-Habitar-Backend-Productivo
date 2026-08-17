import { Router } from 'express';
import { resultController } from '../controllers/result.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateQuery } from '../middlewares/validate.middleware';
import { compareResultsQuerySchema } from '../dto/result.dto';

export const resultRouter = Router();

resultRouter.get(
  '/courses/:courseId',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  resultController.getCourseSummary.bind(resultController),
);

resultRouter.get(
  '/students/:studentId',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  resultController.getStudentDetail.bind(resultController),
);

resultRouter.get(
  '/courses/:courseId/compare',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  validateQuery(compareResultsQuerySchema),
  resultController.comparePeriods.bind(resultController),
);

resultRouter.get(
  '/courses/:courseId/export',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  resultController.exportCourseReport.bind(resultController),
);
