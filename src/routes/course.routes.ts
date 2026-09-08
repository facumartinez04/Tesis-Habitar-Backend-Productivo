import { Router } from 'express';
import { courseController } from '../controllers/course.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { assignCourseTeacherSchema, createCourseSchema, setTeacherCoursesSchema } from '../dto/course.dto';

export const courseRouter = Router();

courseRouter.get('/', requireAuth, requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'), courseController.listMine.bind(courseController));
courseRouter.post('/', requireAuth, requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'), validateBody(createCourseSchema), courseController.create.bind(courseController));
courseRouter.get('/by-qr/:qrCode', requireAuth, courseController.getByQr.bind(courseController));

// Rutas de asignación de aulas a docentes (para Director y Coordinador)
courseRouter.get(
  '/teachers/:teacherId/assignments',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'DIRECTOR', 'ADMIN'),
  courseController.getTeacherAssignments.bind(courseController),
);
courseRouter.put(
  '/teachers/:teacherId/assignments',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'),
  validateBody(setTeacherCoursesSchema),
  courseController.setTeacherAssignments.bind(courseController),
);
courseRouter.patch(
  '/:id/teacher',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'),
  validateBody(assignCourseTeacherSchema),
  courseController.assignTeacher.bind(courseController),
);

courseRouter.get('/:id', requireAuth, courseController.getById.bind(courseController));
