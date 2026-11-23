import { userRepository } from '../dal/user.repository';
import { subscriptionRepository } from '../dal/subscription.repository';
import { institutionRepository } from '../dal/institution.repository';
import { emailService } from '../services/email.service';
import { refreshSessionService } from './refresh-session.service';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/http-error';
import type { CreateInstitutionUserInput, User } from '../domain/user';
import type { Role } from '../domain/enums';

/** Qué pasó con el correo de invitación: 'sent' salió, 'simulated' no hay servicio de correo configurado, 'throttled' superó el límite, 'failed' falló. */
export type InvitationEmailStatus = 'sent' | 'simulated' | 'throttled' | 'failed';
export type InvitedUser = User & { invitationEmail: InvitationEmailStatus };

const EMAIL_TIMEOUT_MS = 10_000;

export interface UserService {
  listByInstitution(institutionId: string): Promise<User[]>;
  inviteUser(input: CreateInstitutionUserInput): Promise<InvitedUser>;
  updateRole(userId: string, institutionId: string, role: Role): Promise<User>;
  setActive(userId: string, institutionId: string, active: boolean): Promise<User>;
}

export class DefaultUserService implements UserService {
  async listByInstitution(institutionId: string): Promise<User[]> {
    return userRepository.findByInstitution(institutionId);
  }

  async inviteUser(input: CreateInstitutionUserInput): Promise<InvitedUser> {
    // El mismo correo puede estar en otras instituciones: acá solo importa que no esté ya en ESTA (y así no se revela
    // si existe en otra).
    const existing = await userRepository.findByEmailInInstitution(input.email, input.institutionId);
    if (existing) throw new ConflictError('Ya existe un usuario con ese email en esta institución');

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

    // El usuario ya quedó creado: si el correo falla, la invitación sigue valiendo y se le avisa a quien invita.
    let invitationEmail: InvitationEmailStatus = 'failed';
    try {
      const result = await Promise.race([
        emailService.sendInvitationEmail({
          to: created.email,
          name: created.name,
          role: created.role,
          institutionName,
          provider: created.provider,
          language: created.language ?? institution?.defaultLanguage,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), EMAIL_TIMEOUT_MS)),
      ]);
      if (!result) console.error('[userService] El envío de correo de invitación tardó demasiado.');
      else if (result.throttled) invitationEmail = 'throttled';
      else if (result.success) invitationEmail = result.simulated ? 'simulated' : 'sent';
    } catch (err) {
      console.error('[userService] Falló el envío de correo de invitación:', err);
    }

    return { ...created, invitationEmail };
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
        language: updated.language ?? institution?.defaultLanguage,
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

    const updated = await userRepository.setActive(userId, active);
    if (!active) await refreshSessionService.revokeAllForUser(userId);
    return updated;
  }

  private async assertBelongsToInstitution(userId: string, institutionId: string): Promise<User | null> {
    const users = await userRepository.findByInstitution(institutionId);
    return users.find((u) => u.id === userId) ?? null;
  }
}

export const userService = new DefaultUserService();
