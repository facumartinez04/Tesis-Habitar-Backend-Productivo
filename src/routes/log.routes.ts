import { Router } from 'express';
import { logController } from '../controllers/log.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

export const logRouter = Router();

logRouter.get('/:kind', requireAuth, requireRole('COORDINADOR', 'ADMIN'), logController.list.bind(logController));
