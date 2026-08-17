import { Router } from 'express';
import { courseController } from '../controllers/course.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

export const courseRouter = Router();

courseRouter.get('/', requireAuth, requireRole('DOCENTE', 'COORDINADOR', 'ADMIN'), courseController.listMine.bind(courseController));
