export type LogKind = 'eventos' | 'errores' | 'auditoria';

export type EventCategory = 'ACCESO' | 'SEGURIDAD' | 'USUARIOS' | 'CONFIGURACION' | 'ACTIVIDADES' | 'DATOS' | 'COMERCIAL';

export const EVENT_CATEGORIES: EventCategory[] = ['ACCESO', 'SEGURIDAD', 'USUARIOS', 'CONFIGURACION', 'ACTIVIDADES', 'DATOS', 'COMERCIAL'];

export const ERROR_SOURCES = ['API', 'PROCESO'] as const;

export const AUDIT_OPERATIONS = ['EXPORTACION', 'ELIMINACION', 'CONSENTIMIENTO'] as const;

export const LOG_TYPES: Record<LogKind, readonly string[]> = {
  eventos: EVENT_CATEGORIES,
  errores: ERROR_SOURCES,
  auditoria: AUDIT_OPERATIONS,
};

export interface LogActor {
  userId: string | null;
  role: string | null;
  institutionId: string | null;
  impersonated: boolean;
  userName?: string | null;
  userEmail?: string | null;
}

export interface NewEvent {
  actor: LogActor;
  institutionId: string | null;
  category: EventCategory;
  type: string;
  entityId?: string | null;
  description: string;
}

export interface NewError {
  source: 'API' | 'PROCESO';
  institutionId: string | null;
  userId: string | null;
  role: string | null;
  method: string | null;
  path: string | null;
  status: number;
  message: string;
  stack: string | null;
}

export interface EventLogEntry {
  id: string;
  createdAt: Date;
  institutionId: string | null;
  institutionName: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  role: string | null;
  impersonated: boolean;
  category: EventCategory;
  type: string;
  entityId: string | null;
  description: string;
}

export interface ErrorLogEntry {
  id: string;
  createdAt: Date;
  source: 'API' | 'PROCESO';
  institutionId: string | null;
  institutionName: string | null;
  userId: string | null;
  userEmail: string | null;
  role: string | null;
  method: string | null;
  path: string | null;
  status: number;
  message: string;
  stack: string | null;
}

export interface AuditLogListEntry {
  id: string;
  date: Date;
  institutionId: string | null;
  institutionName: string | null;
  studentName: string;
  operation: string;
  performedBy: string;
}

export interface LogFilter {
  institutionId: string | null;
  from: string | null;
  to: string | null;
  type: string | null;
  q: string;
  limit: number;
  offset: number;
}
