import { Router } from 'express';
import { courseController } from '../controllers/course.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { assignCourseTeacherSchema, createCourseSchema, setTeacherCoursesSchema } from '../dto/course.dto';

export const courseRouter = Router();

courseRouter.get('/', requireAuth, requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'), courseController.listMine.bind(courseController));
courseRouter.post('/', requireAuth, requireRole('COORDINADOR', 'ADMIN'), validateBody(createCourseSchema), courseController.create.bind(courseController));
courseRouter.get('/by-qr/:qrCode', requireAuth, courseController.getByQr.bind(courseController));
courseRouter.get('/public-info/:qrCode', courseController.getPublicInfoByQr.bind(courseController));

courseRouter.post('/:id/student-devices/bind', courseController.bindStudentDevice.bind(courseController));
courseRouter.get(
  '/:id/student-devices',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'DIRECTOR', 'ADMIN'),
  courseController.listStudentDevices.bind(courseController)
);
courseRouter.delete(
  '/:id/student-devices/:deviceId',
  requireAuth,
  requireRole('DOCENTE', 'COORDINADOR', 'DIRECTOR', 'ADMIN'),
  courseController.unlinkStudentDevice.bind(courseController)
);

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

courseRouter.get(
  '/:id/teachers',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'),
  courseController.listCourseTeachers.bind(courseController)
);
courseRouter.put(
  '/:id/teachers',
  requireAuth,
  requireRole('COORDINADOR', 'DIRECTOR', 'ADMIN'),
  courseController.setCourseTeachers.bind(courseController)
);

courseRouter.get('/:id', requireAuth, courseController.getById.bind(courseController));
