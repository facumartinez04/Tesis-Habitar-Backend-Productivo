import { oauthIntegrationRepository } from '../repositories/oauth.repository';
import { NotFoundError } from '../utils/http-error';
import type { OAuthIntegration, IntegrationStep } from '../domain/oauth';
import type { OAuthProviderId } from '../domain/enums';

const stepLabels: Record<OAuthProviderId, string[]> = {
  GOOGLE: [
    'Recibir el enlace de autorización por correo',
    'Ingresar a la consola de administración de Google Workspace',
    'Autorizar la aplicación Habitar',
    'Integración activada — usuarios pueden iniciar sesión',
  ],
  MICROSOFT: [
    'Recibir el enlace de autorización por correo',
    'Ingresar al centro de administración de Microsoft 365',
    'Autorizar la aplicación Habitar',
    'Integración activada — usuarios pueden iniciar sesión',
  ],
};

function buildSteps(provider: OAuthProviderId, currentStepIndex: number): IntegrationStep[] {
  return stepLabels[provider].map((label, index) => {
    let state: IntegrationStep['state'] = 'TODO';
    if (index < currentStepIndex) state = 'DONE';
    else if (index === currentStepIndex) state = 'WAIT';

    return {
      id: `step-${index + 1}`,
      label,
      state,
      note: state === 'WAIT' ? 'Esperando confirmación del coordinador/a' : undefined,
    };
  });
}

export interface OAuthService {
  getIntegration(institutionId: string): Promise<OAuthIntegration>;
  verifyIntegration(institutionId: string): Promise<OAuthIntegration>;
  resendInvitation(institutionId: string): Promise<void>;
}

export class DefaultOAuthService implements OAuthService {
  async getIntegration(institutionId: string): Promise<OAuthIntegration> {
    const record = await oauthIntegrationRepository.findByInstitution(institutionId);
    if (!record) throw new NotFoundError('No hay integración OAuth configurada para esta institución');

    return {
      institutionId: record.institutionId,
      provider: record.provider,
      clientId: record.clientId,
      steps: buildSteps(record.provider, record.currentStepIndex),
    };
  }

  async verifyIntegration(institutionId: string): Promise<OAuthIntegration> {
    const record = await oauthIntegrationRepository.findByInstitution(institutionId);
    if (!record) throw new NotFoundError('No hay integración OAuth configurada para esta institución');

    const totalSteps = stepLabels[record.provider].length;
    const nextIndex = Math.min(record.currentStepIndex + 1, totalSteps);
    const updated = await oauthIntegrationRepository.advanceStep(institutionId, nextIndex);

    return {
      institutionId,
      provider: record.provider,
      clientId: record.clientId,
      steps: buildSteps(record.provider, updated?.currentStepIndex ?? nextIndex),
    };
  }

  async resendInvitation(institutionId: string): Promise<void> {
    const record = await oauthIntegrationRepository.findByInstitution(institutionId);
    if (!record) throw new NotFoundError('No hay integración OAuth configurada para esta institución');
  }
}

export const oauthService = new DefaultOAuthService();
