import { alertRepository } from '../repositories/alert.repository';
import type { PerformanceAlert } from '../domain/alert';

export interface AlertService {
  getByInstitution(institutionId: string): Promise<PerformanceAlert[]>;
  countOpen(institutionId: string): Promise<number>;
}

export class DefaultAlertService implements AlertService {
  async getByInstitution(institutionId: string): Promise<PerformanceAlert[]> {
    return alertRepository.findByInstitution(institutionId);
  }

  async countOpen(institutionId: string): Promise<number> {
    return alertRepository.countOpenByInstitution(institutionId);
  }
}

export const alertService = new DefaultAlertService();
