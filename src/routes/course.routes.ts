import { Router } from 'express';
import { courseController } from '../controllers/course.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import {
  requireCourseAccess,
  requireUserAccess,
} from '../middlewares/access.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { rateLimit } from '../middlewares/rate-limit.middleware';
import {
  assignCourseTeacherSchema,
  bindStudentDeviceSchema,
  createCourseSchema,
  setTeacherCoursesSchema,
} from '../dto/course.dto';

export const courseRouter = Router();

courseRouter.get('/', requireAuth, requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'), courseController.listMine.bind(courseController));
courseRouter.post('/', requireAuth, requireRole('COORDINADOR', 'ADMIN'), validateBody(createCourseSchema), courseController.create.bind(courseController));
courseRouter.get('/by-qr/:qrCode', requireAuth, courseController.getByQr.bind(courseController));
// Públicas para el alumno; los límites contemplan un aula entera detrás de la misma IP.
const classroomLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 600, name: 'classroom' });

courseRouter.get('/public-info/:qrCode', classroomLimit, courseController.getPublicInfoByQr.bind(courseController));

courseRouter.post(
  '/:id/student-devices/bind',
  classroomLimit,
  validateBody(bindStudentDeviceSchema),
  courseController.bindStudentDevice.bind(courseController),
);
courseRouter.get(
  '/:id/student-devices',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'DIRECTOR', 'ADMIN'),
  requireCourseAccess('id'), courseController.listStudentDevices.bind(courseController)
);
courseRouter.delete(
  '/:id/student-devices/:deviceId',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'DIRECTOR', 'ADMIN'),
  requireCourseAccess('id'), courseController.unlinkStudentDevice.bind(courseController)
);

courseRouter.get(
  '/teachers/:teacherId/assignments',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'DIRECTOR', 'ADMIN'),
  requireUserAccess('teacherId'), courseController.getTeacherAssignments.bind(courseController),
);
courseRouter.put(
  '/teachers/:teacherId/assignments',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'),
  validateBody(setTeacherCoursesSchema),
  requireUserAccess('teacherId'), courseController.setTeacherAssignments.bind(courseController),
);
courseRouter.patch(
  '/:id/teacher',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'),
  validateBody(assignCourseTeacherSchema),
  requireCourseAccess('id'), courseController.assignTeacher.bind(courseController),
);

courseRouter.get(
  '/:id/teachers',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'),
  requireCourseAccess('id'), courseController.listCourseTeachers.bind(courseController)
);
courseRouter.put(
  '/:id/teachers',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'),
  requireCourseAccess('id'), courseController.setCourseTeachers.bind(courseController)
);

courseRouter.get('/:id', requireAuth, requireCourseAccess('id'), courseController.getById.bind(courseController));
