import { Router } from 'express';
import { resultController } from '../controllers/result.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import {
  requireCourseAccess,
  requireStudentAccess,
} from '../middlewares/access.middleware';
import { validateQuery } from '../middlewares/validate.middleware';
import { compareResultsQuerySchema } from '../dto/result.dto';

export const resultRouter = Router();

resultRouter.get(
  '/courses/:courseId',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  requireCourseAccess('courseId'), resultController.getCourseSummary.bind(resultController),
);

resultRouter.get(
  '/students/:studentId',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  requireStudentAccess('studentId'), resultController.getStudentDetail.bind(resultController),
);

resultRouter.get(
  '/courses/:courseId/compare',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  validateQuery(compareResultsQuerySchema),
  requireCourseAccess('courseId'), resultController.comparePeriods.bind(resultController),
);

resultRouter.get(
  '/courses/:courseId/export',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  requireCourseAccess('courseId'), resultController.exportCourseReport.bind(resultController),
);

// Evolución entre la diagnóstica de inicio y la de cierre del ciclo (mejora 1).
resultRouter.get(
  '/courses/:courseId/diagnostic',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  requireCourseAccess('courseId'),
  resultController.getDiagnostic.bind(resultController),
);

// Eje que conviene reforzar con la próxima actividad (mejora 2).
resultRouter.get(
  '/courses/:courseId/recommendation',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'),
  requireCourseAccess('courseId'),
  resultController.getRecommendation.bind(resultController),
);
