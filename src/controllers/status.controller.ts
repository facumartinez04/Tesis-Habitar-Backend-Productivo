import type { Request, Response } from 'express';
import { getStatusReport } from '../bll/status.service';

export class StatusController {
  async get(_req: Request, res: Response): Promise<void> {
    const report = await getStatusReport();
    res.status(report.status === 'down' ? 503 : 200).json(report);
  }
}

export const statusController = new StatusController();
