import type { Request, Response } from 'express';
import { userService } from '../services/user.service';
import type { CreateInstitutionUserDto, SetUserActiveDto, UpdateUserRoleDto } from '../dto/user.dto';

export class UserController {
  async listByInstitution(req: Request, res: Response): Promise<void> {
    const users = await userService.listByInstitution(String(req.params.institutionId));
    res.json(users);
  }

  async invite(req: Request, res: Response): Promise<void> {
    const body = req.body as CreateInstitutionUserDto;
    const user = await userService.inviteUser({ ...body, institutionId: String(req.params.institutionId) });
    res.status(201).json(user);
  }

  async updateRole(req: Request, res: Response): Promise<void> {
    const { role } = req.body as UpdateUserRoleDto;
    const user = await userService.updateRole(String(req.params.userId), String(req.params.institutionId), role);
    res.json(user);
  }

  async setActive(req: Request, res: Response): Promise<void> {
    const { active } = req.body as SetUserActiveDto;
    const user = await userService.setActive(String(req.params.userId), String(req.params.institutionId), active);
    res.json(user);
  }
}

export const userController = new UserController();
