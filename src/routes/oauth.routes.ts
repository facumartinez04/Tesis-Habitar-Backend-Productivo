import { Router } from 'express';
import { oauthController } from '../controllers/oauth.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

export const oauthRouter = Router();

oauthRouter.use(requireAuth, requireRole('ADMIN'));

oauthRouter.get('/:institutionId', oauthController.getIntegration.bind(oauthController));
oauthRouter.post('/:institutionId/verify', oauthController.verify.bind(oauthController));
oauthRouter.post('/:institutionId/resend', oauthController.resend.bind(oauthController));
