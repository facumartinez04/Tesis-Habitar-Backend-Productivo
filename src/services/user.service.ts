import { userRepository } from '../repositories/user.repository';
import { subscriptionRepository } from '../repositories/subscription.repository';
import { institutionRepository } from '../repositories/institution.repository';
import { emailService } from './email.service';
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

    const created = await userRepository.create(input);

    const institution = await institutionRepository.findById(input.institutionId);
    const institutionName = institution?.name ?? 'tu institución educativa';

    emailService
      .sendInvitationEmail({
        to: created.email,
        name: created.name,
        role: created.role,
        institutionName,
        provider: created.provider,
      })
      .catch((err) => {
        console.error('[userService] Falló el envío de correo de invitación:', err);
      });

    return created;
  }

  async updateRole(userId: string, institutionId: string, role: Role): Promise<User> {
    const user = await this.assertBelongsToInstitution(userId, institutionId);
    if (!user) throw new NotFoundError('Usuario no encontrado en esta institución');
    const updated = await userRepository.updateRole(userId, role);

    const institution = await institutionRepository.findById(institutionId);
    const institutionName = institution?.name ?? 'tu institución educativa';

    emailService
      .sendRoleUpdatedEmail({
        to: updated.email,
        name: updated.name,
        newRole: updated.role,
        institutionName,
      })
      .catch((err) => {
        console.error('[userService] Falló el envío de correo de actualización de rol:', err);
      });

    return updated;
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
