import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { rateLimit } from '../middlewares/rate-limit.middleware';

export const authRouter = Router();

// El único camino a una sesión es el login institucional por OpenID Connect.
// Se eliminaron POST /login y POST /admin-session, que emitían tokens sin
// credenciales.
authRouter.get('/me', requireAuth, authController.me.bind(authController));
authRouter.post('/logout', requireAuth, authController.logout.bind(authController));

const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, name: 'login' });
authRouter.get('/:provider', loginLimit, authController.redirectToProvider.bind(authController));
authRouter.get('/:provider/callback', loginLimit, authController.handleOAuthCallback.bind(authController));
