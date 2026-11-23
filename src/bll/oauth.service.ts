import { institutionRepository } from '../dal/institution.repository';
import { env } from '../config/env';
import { BadRequestError, NotFoundError } from '../utils/http-error';
import { isTenantId } from './microsoft-identity';
import { logService } from './log.service';
import type { LogActor } from '../domain/log';
import type { OAuthAccessStatus } from '../domain/oauth';

function toStatus(institution: Awaited<ReturnType<typeof institutionRepository.findById>>): OAuthAccessStatus {
  if (!institution) throw new NotFoundError('Institución no encontrada');
  return {
    institutionId: institution.id,
    domain: institution.domain,
    coordinatorEmail: institution.coordinatorEmail,
    institutionStatus: institution.status,
    googleConfigured: Boolean(env.oauth.google.clientId && env.oauth.google.clientSecret),
    microsoftConfigured: Boolean(env.oauth.microsoft.clientId && env.oauth.microsoft.clientSecret),
    microsoftTenantId: institution.microsoftTenantId,
  };
}

export interface OAuthService {
  getAccessStatus(institutionId: string): Promise<OAuthAccessStatus>;
  activate(institutionId: string): Promise<OAuthAccessStatus>;
  deactivate(institutionId: string): Promise<OAuthAccessStatus>;
  setMicrosoftTenant(institutionId: string, tenantId: string | null, by: LogActor): Promise<OAuthAccessStatus>;
}

export class DefaultOAuthService implements OAuthService {
  async getAccessStatus(institutionId: string): Promise<OAuthAccessStatus> {
    const institution = await institutionRepository.findById(institutionId);
    return toStatus(institution);
  }

  async activate(institutionId: string): Promise<OAuthAccessStatus> {
    const institution = await institutionRepository.findById(institutionId);
    if (!institution) throw new NotFoundError('Institución no encontrada');
    const updated = await institutionRepository.updateStatus(institutionId, 'ACTIVO');
    return toStatus(updated);
  }

  async deactivate(institutionId: string): Promise<OAuthAccessStatus> {
    const institution = await institutionRepository.findById(institutionId);
    if (!institution) throw new NotFoundError('Institución no encontrada');
    const updated = await institutionRepository.updateStatus(institutionId, 'PILOTO_NO_CONFIRMADO');
    return toStatus(updated);
  }

  async setMicrosoftTenant(institutionId: string, tenantId: string | null, by: LogActor): Promise<OAuthAccessStatus> {
    const institution = await institutionRepository.findById(institutionId);
    if (!institution) throw new NotFoundError('Institución no encontrada');
    const value = tenantId?.trim().toLowerCase() || null;
    if (value && !isTenantId(value)) throw new BadRequestError('El ID de organización de Microsoft no es válido');
    const updated = await institutionRepository.updateMicrosoftTenant(institutionId, value);
    void logService.event({
      actor: by,
      institutionId,
      category: 'SEGURIDAD',
      type: 'TENANT_MICROSOFT',
      description: value
        ? `Se vinculó la institución con la organización de Microsoft ${value}.`
        : 'Se quitó la organización de Microsoft vinculada a la institución.',
    });
    return toStatus(updated);
  }
}

export const oauthService = new DefaultOAuthService();
