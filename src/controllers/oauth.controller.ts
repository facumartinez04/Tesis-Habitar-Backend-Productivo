import type { Request, Response } from 'express';
import { oauthService } from '../services/oauth.service';

export class OAuthController {
  async getStatus(req: Request, res: Response): Promise<void> {
    const status = await oauthService.getAccessStatus(String(req.params.institutionId));
    res.json(status);
  }

  async activate(req: Request, res: Response): Promise<void> {
    const status = await oauthService.activate(String(req.params.institutionId));
    res.json(status);
  }

  async deactivate(req: Request, res: Response): Promise<void> {
    const status = await oauthService.deactivate(String(req.params.institutionId));
    res.json(status);
  }
}

export const oauthController = new OAuthController();
