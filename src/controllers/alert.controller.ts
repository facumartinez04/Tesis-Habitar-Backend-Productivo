import type { Request, Response } from 'express';
import { alertService } from '../services/alert.service';

export class AlertController {
  async getByInstitution(req: Request, res: Response): Promise<void> {
    const alerts = await alertService.getByInstitution(String(req.params.institutionId));
    res.json(alerts);
  }
}

export const alertController = new AlertController();
