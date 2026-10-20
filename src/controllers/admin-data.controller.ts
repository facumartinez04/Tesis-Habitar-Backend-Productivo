import type { Request, Response } from 'express';
import { adminDataService } from '../bll/admin-data.service';
import { readPage, type PageRequest } from '../utils/pagination';
import { actorFrom } from '../bll/log.service';

const pageFrom = (req: Request): PageRequest => readPage(req) ?? { page: 1, pageSize: 20, q: '' };

export class AdminDataController {
  async activities(req: Request, res: Response): Promise<void> {
    res.json(await adminDataService.activities(String(req.params.institutionId), pageFrom(req)));
  }

  async courses(req: Request, res: Response): Promise<void> {
    res.json(await adminDataService.courses(String(req.params.institutionId), pageFrom(req)));
  }

  async students(req: Request, res: Response): Promise<void> {
    res.json(await adminDataService.students(String(req.params.institutionId), pageFrom(req)));
  }

  async deletions(req: Request, res: Response): Promise<void> {
    res.json(await adminDataService.deletions(String(req.params.institutionId), pageFrom(req)));
  }

  async deleteActivity(req: Request, res: Response): Promise<void> {
    res.json(await adminDataService.deleteActivity(String(req.params.id), req.auth!.sub, actorFrom(req)));
  }

  async deleteCourse(req: Request, res: Response): Promise<void> {
    res.json(await adminDataService.deleteCourse(String(req.params.id), req.auth!.sub, actorFrom(req)));
  }

  async deleteStudent(req: Request, res: Response): Promise<void> {
    res.json(await adminDataService.deleteStudent(String(req.params.id), req.auth!.sub, actorFrom(req)));
  }
}

export const adminDataController = new AdminDataController();
