import { userRepository } from '../repositories/user.repository';
import { subscriptionRepository } from '../repositories/subscription.repository';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/http-error';
import type { CreateInstitutionUserInput, User } from '../domain/user';
import type { Role } from '../domain/enums';

export interface UserService {
  listByInstitution(institutionId: string): Promise<User[]>;
  inviteUser(input: CreateInstitutionUserInput): Promise<User>;
  updateRole(userId: string, institutionId: string, role: Role): Promise<User>;
  setActive(userId: string, institutionId: string, active: boolean): Promise<User>;
}

export class DefaultUserService implements UserService {
  async listByInstitution(institutionId: string): Promise<User[]> {
    return userRepository.findByInstitution(institutionId);
  }

  async inviteUser(input: CreateInstitutionUserInput): Promise<User> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw new ConflictError('Ya existe un usuario con ese email');

    const [activeCount, maxUsers] = await Promise.all([
      userRepository.countActiveByInstitution(input.institutionId),
      subscriptionRepository.getMaxUsersForInstitution(input.institutionId),
    ]);

    if (activeCount >= maxUsers) {
      throw new BadRequestError(`Se alcanzó el límite de usuarios del plan (${maxUsers}). Gestioná la ampliación del plan.`);
    }

    return userRepository.create(input);
  }

  async updateRole(userId: string, institutionId: string, role: Role): Promise<User> {
    const user = await this.assertBelongsToInstitution(userId, institutionId);
    if (!user) throw new NotFoundError('Usuario no encontrado en esta institución');
    return userRepository.updateRole(userId, role);
  }

  async setActive(userId: string, institutionId: string, active: boolean): Promise<User> {
    const user = await this.assertBelongsToInstitution(userId, institutionId);
    if (!user) throw new NotFoundError('Usuario no encontrado en esta institución');

    if (active) {
      const [activeCount, maxUsers] = await Promise.all([
        userRepository.countActiveByInstitution(institutionId),
        subscriptionRepository.getMaxUsersForInstitution(institutionId),
      ]);
      if (activeCount >= maxUsers) {
        throw new BadRequestError(`Se alcanzó el límite de usuarios del plan (${maxUsers}). Gestioná la ampliación del plan.`);
      }
    }

    return userRepository.setActive(userId, active);
  }

  private async assertBelongsToInstitution(userId: string, institutionId: string): Promise<User | null> {
    const users = await userRepository.findByInstitution(institutionId);
    return users.find((u) => u.id === userId) ?? null;
  }
}

export const userService = new DefaultUserService();
