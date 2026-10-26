import type { Request, Response } from 'express';
import { adminDataService } from '../bll/admin-data.service';
import { readPage, type PageRequest } from '../utils/pagination';
import { actorFrom } from '../bll/log.service';
import { setInstitutionPause } from '../bll/institution-pause';

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

  async pauseInstitution(req: Request, res: Response): Promise<void> {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;
    res.json({ institutionPaused: await setInstitutionPause(String(req.params.institutionId), true, reason) });
  }

  async resumeInstitution(req: Request, res: Response): Promise<void> {
    res.json({ institutionPaused: await setInstitutionPause(String(req.params.institutionId), false, null) });
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
