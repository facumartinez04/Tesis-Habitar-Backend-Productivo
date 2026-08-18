import { Router } from 'express';
import { oauthController } from '../controllers/oauth.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

export const oauthRouter = Router();

oauthRouter.use(requireAuth, requireRole('ADMIN'));

oauthRouter.get('/:institutionId', oauthController.getStatus.bind(oauthController));
oauthRouter.post('/:institutionId/activate', oauthController.activate.bind(oauthController));
oauthRouter.post('/:institutionId/deactivate', oauthController.deactivate.bind(oauthController));
