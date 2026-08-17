import { monitoringRepository } from '../repositories/monitoring.repository';
import type { MonitoringSnapshot } from '../domain/monitoring';

export interface MonitoringService {
  getSnapshot(): Promise<MonitoringSnapshot>;
}

export class DefaultMonitoringService implements MonitoringService {
  async getSnapshot(): Promise<MonitoringSnapshot> {
    const [components, incidents] = await Promise.all([
      monitoringRepository.listComponents(),
      monitoringRepository.listIncidents(),
    ]);

    const monthlyUptimePercent = components.length
      ? Number((components.reduce((sum, c) => sum + c.uptimePercent, 0) / components.length).toFixed(1))
      : 100;

    const incidentsThisMonth = incidents.filter((incident) => incident.status !== 'PLANIFICADO').length;

    return {
      updatedAt: new Date().toISOString(),
      monthlyUptimePercent,
      latencyP95Seconds: 1.2,
      incidentsThisMonth,
      components,
      incidents,
    };
  }
}

export const monitoringService = new DefaultMonitoringService();
