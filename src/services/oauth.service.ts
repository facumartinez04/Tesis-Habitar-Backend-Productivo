import { institutionRepository } from '../repositories/institution.repository';
import { env } from '../config/env';
import { NotFoundError } from '../utils/http-error';
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
  };
}

export interface OAuthService {
  getAccessStatus(institutionId: string): Promise<OAuthAccessStatus>;
  activate(institutionId: string): Promise<OAuthAccessStatus>;
  deactivate(institutionId: string): Promise<OAuthAccessStatus>;
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
}

export const oauthService = new DefaultOAuthService();
