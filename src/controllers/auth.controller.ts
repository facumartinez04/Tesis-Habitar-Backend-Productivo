import type { Request, Response } from 'express';
import { authService, dashboardPathForRole } from '../services/auth.service';
import type { LoginDto } from '../dto/auth.dto';

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    const { provider } = req.body as LoginDto;
    const session = await authService.loginWithProvider(provider);
    res.json({ ...session, dashboardPath: dashboardPathForRole(session.user.role) });
  }

  async me(req: Request, res: Response): Promise<void> {
    const user = await authService.getSessionUser(req.auth!.sub);
    res.json({ user });
  }

  async adminSession(_req: Request, res: Response): Promise<void> {
    const session = await authService.createAdminSession();
    res.json({ ...session, dashboardPath: dashboardPathForRole(session.user.role) });
  }
}

export const authController = new AuthController();
