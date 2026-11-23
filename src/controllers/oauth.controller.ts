import type { Request, Response } from 'express';
import { z } from 'zod';
import { oauthService } from '../bll/oauth.service';
import { actorFrom } from '../bll/log.service';

const microsoftTenantSchema = z.object({ tenantId: z.string().max(64).nullable() });

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

  async setMicrosoftTenant(req: Request, res: Response): Promise<void> {
    const { tenantId } = microsoftTenantSchema.parse(req.body);
    const status = await oauthService.setMicrosoftTenant(String(req.params.institutionId), tenantId, actorFrom(req));
    res.json(status);
  }
}

export const oauthController = new OAuthController();
