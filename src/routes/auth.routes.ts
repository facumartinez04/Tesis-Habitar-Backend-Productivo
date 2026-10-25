import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { rateLimit } from '../middlewares/rate-limit.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { updateLanguageSchema } from '../dto/auth.dto';

export const authRouter = Router();

authRouter.get('/me', requireAuth, authController.me.bind(authController));
authRouter.patch('/me/language', requireAuth, validateBody(updateLanguageSchema), authController.updateLanguage.bind(authController));
authRouter.get('/integrations', authController.integrations.bind(authController));
authRouter.post('/logout', requireAuth, authController.logout.bind(authController));

const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, name: 'login' });
authRouter.get('/:provider', loginLimit, authController.redirectToProvider.bind(authController));
authRouter.get('/:provider/callback', loginLimit, authController.handleOAuthCallback.bind(authController));
