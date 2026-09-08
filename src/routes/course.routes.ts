import { Router } from 'express';
import { courseController } from '../controllers/course.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { createCourseSchema } from '../dto/course.dto';

export const courseRouter = Router();

courseRouter.get('/', requireAuth, requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'), courseController.listMine.bind(courseController));
courseRouter.post('/', requireAuth, requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'), validateBody(createCourseSchema), courseController.create.bind(courseController));
courseRouter.get('/by-qr/:qrCode', requireAuth, courseController.getByQr.bind(courseController));
courseRouter.get('/:id', requireAuth, courseController.getById.bind(courseController));
