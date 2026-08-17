import type { Request, Response } from 'express';
import { monitoringService } from '../services/monitoring.service';

export class MonitoringController {
  async getSnapshot(_req: Request, res: Response): Promise<void> {
    const snapshot = await monitoringService.getSnapshot();
    res.json(snapshot);
  }
}

export const monitoringController = new MonitoringController();
