import type { ComponentHealth, IncidentStatus } from './enums';

export interface SystemComponentStatus {
  id: string;
  name: string;
  health: ComponentHealth;
  uptimePercent: number;
}

export interface IncidentRecord {
  id: string;
  date: string;
  component: string;
  duration: string;
  status: IncidentStatus;
}

export interface MonitoringSnapshot {
  updatedAt: string;
  monthlyUptimePercent: number | null;
  latencyP95Seconds: number | null;
  incidentsThisMonth: number;
  components: SystemComponentStatus[];
  incidents: IncidentRecord[];
}
