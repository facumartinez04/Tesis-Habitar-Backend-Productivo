import type { NextFunction, Request, Response } from 'express';
import { logService, requestPath } from '../bll/log.service';
import type { EventCategory } from '../domain/log';

type Body = Record<string, unknown> | null;

interface Rule {
  method: string;
  path: RegExp;
  category: EventCategory;
  type: string | ((req: Request, body: Body) => string);
  describe: (m: RegExpExecArray, req: Request, body: Body) => string;
  institution?: 'auth' | 'global' | number | ((m: RegExpExecArray, req: Request, body: Body) => string | null);
  entity?: number | ((m: RegExpExecArray, req: Request, body: Body) => string | null);
}

const str = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const field = (obj: unknown, key: string): string => (obj && typeof obj === 'object' ? str((obj as Record<string, unknown>)[key]) : '');
const named = (body: Body, fallback: string): string => {
  const name = field(body, 'name');
  const code = field(body, 'code');
  return name ? (code ? `«${name}» (${code})` : `«${name}»`) : fallback;
};

const sentence = (prefix: string, body: Body): string => {
  const n = named(body, '');
  return n ? `${prefix} ${n}.` : `${prefix}.`;
};

const ROLE_LABEL: Record<string, string> = { DOCENTE: 'Docente', COORDINADOR: 'Coordinador', DIRECTOR: 'Director', ADMIN: 'Administrador' };
const role = (v: unknown): string => ROLE_LABEL[str(v)] ?? str(v);

const RULES: Rule[] = [
  { method: 'POST', path: /^\/api\/auth\/logout$/, category: 'ACCESO', type: 'LOGOUT', describe: () => 'Cerró sesión.' },

  { method: 'POST', path: /^\/api\/institutions\/([^/]+)\/users$/, category: 'USUARIOS', type: 'USUARIO_INVITADO', institution: 1, entity: (_m, _r, b) => field(b, 'id') || null,
    describe: (_m, req, b) => `Invitó a ${field(b, 'email') || field(req.body, 'email')} como ${role(field(b, 'role') || field(req.body, 'role'))}.` },
  { method: 'PATCH', path: /^\/api\/institutions\/([^/]+)\/users\/([^/]+)\/role$/, category: 'USUARIOS', type: 'ROL_USUARIO_MODIFICADO', institution: 1, entity: 2,
    describe: (_m, req, b) => `Cambió el rol de ${field(b, 'email') || field(b, 'name') || 'un usuario'} a ${role(field(req.body, 'role'))}.` },
  { method: 'PATCH', path: /^\/api\/institutions\/([^/]+)\/users\/([^/]+)\/active$/, category: 'USUARIOS', institution: 1, entity: 2,
    type: (req) => ((req.body as { active?: boolean })?.active ? 'USUARIO_ACTIVADO' : 'USUARIO_DESACTIVADO'),
    describe: (_m, req, b) => `${(req.body as { active?: boolean })?.active ? 'Activó' : 'Desactivó'} la cuenta de ${field(b, 'email') || field(b, 'name') || 'un usuario'}.` },

  { method: 'POST', path: /^\/api\/roles$/, category: 'SEGURIDAD', type: 'ROL_CREADO', institution: 'global', entity: (_m, _r, b) => field(b, 'id') || null, describe: (_m, _r, b) => `Creó el rol ${named(b, 'personalizado')}.` },
  { method: 'PATCH', path: /^\/api\/roles\/([^/]+)$/, category: 'SEGURIDAD', type: 'ROL_MODIFICADO', institution: 'global', entity: 1, describe: (_m, _r, b) => `Modificó el rol ${named(b, 'personalizado')}.` },
  { method: 'DELETE', path: /^\/api\/roles\/([^/]+)$/, category: 'SEGURIDAD', type: 'ROL_ELIMINADO', institution: 'global', entity: 1, describe: () => 'Eliminó un rol personalizado.' },
  { method: 'POST', path: /^\/api\/oauth\/([^/]+)\/activate$/, category: 'SEGURIDAD', type: 'OAUTH_HABILITADO', institution: 1, describe: () => 'Habilitó el acceso OAuth de la institución.' },
  { method: 'POST', path: /^\/api\/oauth\/([^/]+)\/deactivate$/, category: 'SEGURIDAD', type: 'OAUTH_DESHABILITADO', institution: 1, describe: () => 'Deshabilitó el acceso OAuth de la institución.' },
  { method: 'POST', path: /^\/api\/jira\/tokens$/, category: 'SEGURIDAD', type: 'TOKEN_API_CREADO', institution: 'global', describe: (_m, _r, b) => sentence('Creó un token de API para agentes', b) },
  { method: 'DELETE', path: /^\/api\/jira\/tokens\/([^/]+)$/, category: 'SEGURIDAD', type: 'TOKEN_API_REVOCADO', institution: 'global', entity: 1, describe: () => 'Revocó un token de API para agentes.' },

  { method: 'POST', path: /^\/api\/institutions$/, category: 'CONFIGURACION', type: 'INSTITUCION_CREADA', institution: (_m, _r, b) => field(b, 'id') || null, entity: (_m, _r, b) => field(b, 'id') || null,
    describe: (_m, _r, b) => sentence('Dio de alta la institución', b) },
  { method: 'PATCH', path: /^\/api\/institutions\/([^/]+)\/config$/, category: 'CONFIGURACION', type: 'CONFIGURACION_INSTITUCION', institution: 1, describe: () => 'Modificó la configuración de la institución.' },
  { method: 'PATCH', path: /^\/api\/institutions\/([^/]+)\/status$/, category: 'CONFIGURACION', type: 'ESTADO_INSTITUCION', institution: 1,
    describe: (_m, req) => `Cambió el estado de la institución a ${field(req.body, 'status')}.` },
  { method: 'PATCH', path: /^\/api\/compliance\/retention\/([^/]+)$/, category: 'CONFIGURACION', type: 'POLITICA_RETENCION', institution: 1,
    describe: (_m, req) => `Fijó la retención de datos en ${field(req.body, 'retentionMonths')} meses.` },
  { method: 'PATCH', path: /^\/api\/admin\/institutions\/([^/]+)\/ai-budget$/, category: 'CONFIGURACION', type: 'PRESUPUESTO_IA', institution: 1, describe: () => 'Modificó el presupuesto mensual de IA de la institución.' },
  { method: 'POST', path: /^\/api\/finances\/institution\/([^/]+)\/config$/, category: 'CONFIGURACION', type: 'CONFIGURACION_COBROS', institution: 1, describe: () => 'Modificó la configuración de cobros de la institución.' },
  { method: 'POST', path: /^\/api\/finances\/platform\/config$/, category: 'CONFIGURACION', type: 'CONFIGURACION_COBROS', institution: 'global', describe: () => 'Modificó la configuración de cobros de la plataforma.' },

  { method: 'POST', path: /^\/api\/activities$/, category: 'ACTIVIDADES', type: 'ACTIVIDAD_CREADA', entity: (_m, _r, b) => field(b, 'id') || null, describe: (_m, _r, b) => sentence('Creó la actividad', b) },
  { method: 'POST', path: /^\/api\/activities\/([^/]+)\/publish$/, category: 'ACTIVIDADES', type: 'ACTIVIDAD_PUBLICADA', entity: 1, describe: (_m, _r, b) => sentence('Publicó la actividad', b) },
  { method: 'POST', path: /^\/api\/activities\/([^/]+)\/close$/, category: 'ACTIVIDADES', type: 'ACTIVIDAD_CERRADA', entity: 1, describe: (_m, _r, b) => sentence('Cerró la actividad', b) },
  { method: 'POST', path: /^\/api\/activities\/([^/]+)\/release$/, category: 'ACTIVIDADES', type: 'PREGUNTAS_LIBERADAS', entity: 1, describe: (_m, _r, b) => sentence('Liberó las preguntas de la actividad', b) },
  { method: 'POST', path: /^\/api\/activities\/([^/]+)\/duplicate$/, category: 'ACTIVIDADES', type: 'ACTIVIDAD_DUPLICADA', entity: 1, describe: (_m, _r, b) => `Duplicó una actividad como ${named(b, 'una nueva')}.` },
  { method: 'PATCH', path: /^\/api\/activities\/([^/]+)\/questions\/([^/]+)$/, category: 'ACTIVIDADES', type: 'PREGUNTA_EDITADA', entity: 1, describe: () => 'Editó una pregunta de una actividad en curso.' },
  { method: 'POST', path: /^\/api\/courses$/, category: 'ACTIVIDADES', type: 'CURSO_CREADO', entity: (_m, _r, b) => field(b, 'id') || null, describe: (_m, _r, b) => sentence('Creó el curso', b) },
  { method: 'PUT', path: /^\/api\/courses\/([^/]+)\/teachers$/, category: 'ACTIVIDADES', type: 'DOCENTES_ASIGNADOS', entity: 1, describe: () => 'Modificó los docentes asignados a un curso.' },
  { method: 'PATCH', path: /^\/api\/courses\/([^/]+)\/teacher$/, category: 'ACTIVIDADES', type: 'DOCENTES_ASIGNADOS', entity: 1, describe: () => 'Reasignó el docente de un curso.' },
  { method: 'PUT', path: /^\/api\/courses\/teachers\/([^/]+)\/assignments$/, category: 'ACTIVIDADES', type: 'DOCENTES_ASIGNADOS', entity: 1, describe: () => 'Modificó los cursos asignados a un docente.' },
  { method: 'DELETE', path: /^\/api\/courses\/([^/]+)\/student-devices\/([^/]+)$/, category: 'DATOS', type: 'DISPOSITIVO_DESVINCULADO', entity: 2, describe: () => 'Desvinculó el dispositivo de un alumno.' },
  { method: 'POST', path: /^\/api\/compliance\/retention\/([^/]+)\/purge$/, category: 'DATOS', type: 'PURGA_DATOS', institution: 1,
    describe: (_m, _r, b) => `Ejecutó la purga por retención: ${field(b, 'purgedStudentCount') || '0'} alumnos eliminados.` },

  { method: 'POST', path: /^\/api\/subscriptions\/([^/]+)\/renew$/, category: 'COMERCIAL', type: 'SUSCRIPCION_RENOVADA', entity: 1, institution: (_m, _r, b) => field(b, 'institutionId') || null, describe: () => 'Renovó una suscripción.' },
  { method: 'PATCH', path: /^\/api\/subscriptions\/([^/]+)$/, category: 'COMERCIAL', type: 'SUSCRIPCION_MODIFICADA', entity: 1, institution: (_m, _r, b) => field(b, 'institutionId') || null, describe: () => 'Modificó una suscripción.' },
  { method: 'POST', path: /^\/api\/subscriptions\/plans$/, category: 'COMERCIAL', type: 'PLAN_CREADO', institution: 'global', describe: (_m, _r, b) => sentence('Creó el plan', b) },
  { method: 'PATCH', path: /^\/api\/subscriptions\/plans\/([^/]+)$/, category: 'COMERCIAL', type: 'PLAN_MODIFICADO', institution: 'global', entity: 1, describe: (_m, _r, b) => sentence('Modificó el plan', b) },
  { method: 'DELETE', path: /^\/api\/subscriptions\/plans\/([^/]+)$/, category: 'COMERCIAL', type: 'PLAN_ELIMINADO', institution: 'global', entity: 1, describe: () => 'Eliminó un plan.' },
  { method: 'PATCH', path: /^\/api\/finances\/institution\/([^/]+)\/fees\/([^/]+)\/status$/, category: 'COMERCIAL', type: 'CUOTA_ESTADO', institution: 1, entity: 2,
    describe: (_m, req) => `Cambió el estado de una cuota a ${field(req.body, 'status')}.` },
];

function institutionFor(rule: Rule, m: RegExpExecArray, req: Request, body: Body): string | null {
  const how = rule.institution ?? 'auth';
  if (how === 'global') return null;
  if (how === 'auth') return req.auth?.institutionId ?? null;
  if (typeof how === 'number') return m[how] ?? null;
  return how(m, req, body);
}

function entityFor(rule: Rule, m: RegExpExecArray, req: Request, body: Body): string | null {
  if (rule.entity === undefined) return null;
  if (typeof rule.entity === 'number') return m[rule.entity] ?? null;
  return rule.entity(m, req, body);
}

export function eventLog(req: Request, res: Response, next: NextFunction): void {
  let body: Body = null;
  const json = res.json.bind(res);
  res.json = (value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) body = value as Record<string, unknown>;
    return json(value);
  };

  res.on('finish', () => {
    const path = requestPath(req);
    if (res.statusCode === 403 && req.auth) {
      void logService.eventFromRequest(req, 'SEGURIDAD', 'ACCESO_DENEGADO', `Intento sin permiso: ${req.method} ${path}.`);
      return;
    }
    if (res.statusCode < 200 || res.statusCode >= 300 || !req.auth) return;
    for (const rule of RULES) {
      if (rule.method !== req.method) continue;
      const m = rule.path.exec(path);
      if (!m) continue;
      const type = typeof rule.type === 'function' ? rule.type(req, body) : rule.type;
      void logService.eventFromRequest(req, rule.category, type, rule.describe(m, req, body), {
        institutionId: institutionFor(rule, m, req, body),
        entityId: entityFor(rule, m, req, body),
      });
      return;
    }
  });

  next();
}
