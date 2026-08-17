import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { loginSchema } from '../dto/auth.dto';

export const authRouter = Router();

authRouter.post('/login', validateBody(loginSchema), authController.login.bind(authController));
authRouter.get('/me', requireAuth, authController.me.bind(authController));
authRouter.post('/admin-session', authController.adminSession.bind(authController));
