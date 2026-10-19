import { query } from '../config/db';
import type { IncidentRecord, SystemComponentStatus } from '../domain/monitoring';

export interface MonitoringRepository {
  listComponents(): Promise<SystemComponentStatus[]>;
  listIncidents(): Promise<IncidentRecord[]>;
}

export class SqlMonitoringRepository implements MonitoringRepository {
  async listComponents(): Promise<SystemComponentStatus[]> {
    return query<SystemComponentStatus>('SELECT "id", "name", "health", "uptimePercent" FROM "MonitoringComponent"');
  }

  async listIncidents(): Promise<IncidentRecord[]> {
    return query<IncidentRecord>('SELECT "id", "date", "component", "duration", "status" FROM "Incident"');
  }
}

export const monitoringRepository = new SqlMonitoringRepository();
