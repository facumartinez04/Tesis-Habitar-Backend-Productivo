import { Router } from 'express';
import { statusController } from '../controllers/status.controller';

export const statusRouter = Router();

statusRouter.get('/', statusController.get.bind(statusController));
