import type { Request, Response } from 'express';
import { metricsRepository } from '../dal/metrics.repository';

export class MetricsController {
  async institution(req: Request, res: Response): Promise<void> {
    res.json(await metricsRepository.usage(String(req.params.institutionId)));
  }

  async platform(_req: Request, res: Response): Promise<void> {
    res.json(await metricsRepository.usage(null));
  }
}

export const metricsController = new MetricsController();
