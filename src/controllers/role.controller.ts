import type { Request, Response, NextFunction } from 'express';
import { roleService } from '../services/role.service';
import { PLATFORM_MODULES } from '../domain/role';

export class RoleController {
  async listModules(_req: Request, res: Response): Promise<void> {
    res.json({ modules: PLATFORM_MODULES });
  }

  async getAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await roleService.getAllRoles();
      res.json({ roles });
    } catch (err) {
      next(err);
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = await roleService.getRoleById(String(req.params.id));
      res.json({ role });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = await roleService.createRole(req.body);
      res.status(201).json({ role });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = await roleService.updateRole(String(req.params.id), req.body);
      res.json({ role });
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await roleService.deleteRole(String(req.params.id));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
}

export const roleController = new RoleController();
