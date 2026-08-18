import { Router } from 'express';
import { statusController } from '../controllers/status.controller';

export const statusRouter = Router();

// Público a propósito (sin requireAuth): pensado para diagnosticar deploys
// desde afuera. No expone secretos, solo si cada cosa está configurada o no.
statusRouter.get('/', statusController.get.bind(statusController));
