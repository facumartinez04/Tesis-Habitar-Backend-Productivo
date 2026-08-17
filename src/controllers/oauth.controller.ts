import type { Request, Response } from 'express';
import { oauthService } from '../services/oauth.service';

export class OAuthController {
  async getIntegration(req: Request, res: Response): Promise<void> {
    const integration = await oauthService.getIntegration(String(req.params.institutionId));
    res.json(integration);
  }

  async verify(req: Request, res: Response): Promise<void> {
    const integration = await oauthService.verifyIntegration(String(req.params.institutionId));
    res.json(integration);
  }

  async resend(req: Request, res: Response): Promise<void> {
    await oauthService.resendInvitation(String(req.params.institutionId));
    res.status(204).send();
  }
}

export const oauthController = new OAuthController();
