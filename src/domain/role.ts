export type PlatformModule =
  | 'instituciones'
  | 'configuracion'
  | 'usuarios'
  | 'cursos'
  | 'actividades'
  | 'alumnos'
  | 'resultados'
  | 'alertas'
  | 'cumplimiento'
  | 'suscripciones'
  | 'monitoreo'
  | 'jira'
  | 'roles'
  | 'finanzas';

export const PLATFORM_MODULES: { id: PlatformModule; name: string; description: string }[] = [
  { id: 'instituciones', name: 'Instituciones', description: 'Gestión y alta de colegios e instituciones educativas' },
  { id: 'configuracion', name: 'Configuración Institucional', description: 'Parámetros pedagógicos, umbrales y cuotas de IA' },
  { id: 'usuarios', name: 'Usuarios y Docentes', description: 'Invitación, asignación de roles y estados de acceso' },
  { id: 'cursos', name: 'Cursos y Divisiones', description: 'Nómina de cursos, materias y asignaciones' },
  { id: 'actividades', name: 'Actividades & IA', description: 'Creación de lecturas, preguntas con DeepSeek y publicación' },
  { id: 'alumnos', name: 'Alumnos', description: 'Padrón de estudiantes y fichas de seguimiento' },
  { id: 'resultados', name: 'Resultados & Analítica', description: 'Métricas de comprensión lectora y comparativas' },
  { id: 'alertas', name: 'Alertas Tempranas', description: 'Monitoreo de riesgo pedagógico y detección de rezago' },
  { id: 'cumplimiento', name: 'Cumplimiento (ARCO)', description: 'Derechos de portabilidad, supresión y retención legal' },
  { id: 'suscripciones', name: 'Suscripciones y Planes', description: 'Facturación, contratos y cuotas de alumnos' },
  { id: 'monitoreo', name: 'Monitoreo de Sistema', description: 'Disponibilidad de infraestructura, latencia y salud' },
  { id: 'jira', name: 'Jira y Tareas de IA', description: 'Tablero Kanban, sprints y tokens para agentes de IA' },
  { id: 'roles', name: 'Roles y Permisos', description: 'Administración del modelo de control de acceso (RBAC)' },
  { id: 'finanzas', name: 'Finanzas y Mercado Pago', description: 'Control de gastos, balances, cobranzas e integración con Mercado Pago' },
];

export interface RolePermission {
  module: PlatformModule;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: RolePermission[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleDto {
  id?: string;
  name: string;
  description?: string;
  permissions?: RolePermission[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissions?: RolePermission[];
}
