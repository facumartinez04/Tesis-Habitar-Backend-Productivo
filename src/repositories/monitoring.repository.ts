import { prisma } from '../config/prisma';
import type { IncidentRecord, SystemComponentStatus } from '../domain/monitoring';

export interface MonitoringRepository {
  listComponents(): Promise<SystemComponentStatus[]>;
  listIncidents(): Promise<IncidentRecord[]>;
}

export class PrismaMonitoringRepository implements MonitoringRepository {
  async listComponents(): Promise<SystemComponentStatus[]> {
    const records = await prisma.monitoringComponent.findMany();
    return records.map((r) => ({ id: r.id, name: r.name, health: r.health, uptimePercent: r.uptimePercent }));
  }

  async listIncidents(): Promise<IncidentRecord[]> {
    const records = await prisma.incident.findMany();
    return records.map((r) => ({ id: r.id, date: r.date, component: r.component, duration: r.duration, status: r.status }));
  }
}

export const monitoringRepository = new PrismaMonitoringRepository();
