import { Router } from 'express';
import { monitoringController } from '../controllers/monitoring.controller';
import { metricsController } from '../controllers/metrics.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

export const monitoringRouter = Router();

monitoringRouter.get('/', requireAuth, requireRole('ADMIN'), monitoringController.getSnapshot.bind(monitoringController));

// Métricas de uso de toda la plataforma (mejora 4).
monitoringRouter.get('/usage', requireAuth, requireRole('ADMIN'), metricsController.platform.bind(metricsController));
