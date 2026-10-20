import type { Request } from 'express';
import { logRepository } from '../dal/log.repository';
import { userRepository } from '../dal/user.repository';
import { BadRequestError } from '../utils/http-error';
import { pageOf, type PageRequest } from '../utils/pagination';
import { LOG_TYPES, type EventCategory, type LogActor, type LogFilter, type LogKind, type NewEvent } from '../domain/log';

const USER_CACHE_MS = 10 * 60 * 1000;
const IMPERSONATION_WINDOW_MS = 30 * 60 * 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ROLE_LABEL: Record<string, string> = { DOCENTE: 'Docente', COORDINADOR: 'Coordinador', DIRECTOR: 'Director', ADMIN: 'Administrador' };

const userCache = new Map<string, { name: string; email: string; until: number }>();
const impersonationSeen = new Map<string, number>();

async function userInfo(userId: string | null): Promise<{ name: string | null; email: string | null }> {
  if (!userId) return { name: null, email: null };
  const cached = userCache.get(userId);
  if (cached && cached.until > Date.now()) return cached;
  const user = await userRepository.findById(userId);
  if (!user) return { name: null, email: null };
  const info = { name: user.name, email: user.email, until: Date.now() + USER_CACHE_MS };
  userCache.set(userId, info);
  return info;
}

export function actorFrom(req: Request): LogActor {
  return {
    userId: req.auth?.sub ?? null,
    role: req.auth?.role ?? null,
    institutionId: req.auth?.institutionId ?? null,
    impersonated: Boolean(req.auth?.impersonated),
  };
}

export function requestPath(req: Request): string {
  const url = req.originalUrl || req.url;
  const i = url.indexOf('?');
  return i >= 0 ? url.slice(0, i) : url;
}

export interface LogScope {
  platformAdmin: boolean;
  institutionId: string | null;
}

export interface LogQuery {
  institutionId?: string;
  from?: string;
  to?: string;
  type?: string;
}

export class LogService {
  async event(input: Omit<NewEvent, 'actor'> & { actor: LogActor }): Promise<void> {
    try {
      const info = input.actor.userName || input.actor.userEmail ? { name: input.actor.userName ?? null, email: input.actor.userEmail ?? null } : await userInfo(input.actor.userId);
      await logRepository.insertEvent({ ...input, actor: { ...input.actor, userName: info.name, userEmail: info.email } });
    } catch (err) {
      console.error('[bitacora] no se pudo registrar el evento', err);
    }
  }

  async eventFromRequest(req: Request, category: EventCategory, type: string, description: string, options: { institutionId?: string | null; entityId?: string | null } = {}): Promise<void> {
    const actor = actorFrom(req);
    await this.event({
      actor,
      institutionId: options.institutionId === undefined ? actor.institutionId : options.institutionId,
      category,
      type,
      entityId: options.entityId ?? null,
      description,
    });
  }

  async error(err: unknown, context: { source: 'API' | 'PROCESO'; req?: Request; status?: number }): Promise<void> {
    try {
      const req = context.req;
      const path = req ? requestPath(req) : null;
      let institutionId = req?.auth?.institutionId ?? null;
      if (!institutionId && path) {
        const code = /^\/api\/activities\/(HAB-[A-Z0-9]+)/i.exec(path)?.[1];
        if (code) institutionId = await logRepository.institutionIdForActivityCode(code.toUpperCase());
      }
      const userId = req?.auth?.sub ?? null;
      await logRepository.insertError({
        source: context.source,
        institutionId,
        userId,
        userEmail: (await userInfo(userId)).email,
        role: req?.auth?.role ?? null,
        method: req?.method ?? null,
        path,
        status: context.status ?? 500,
        message: err instanceof Error ? err.message || err.name : String(err),
        stack: err instanceof Error ? err.stack ?? null : null,
      });
    } catch (logErr) {
      console.error('[bitacora] no se pudo registrar el error', logErr);
    }
  }

  noteImpersonation(req: Request): void {
    const auth = req.auth;
    if (!auth?.impersonated) return;
    const key = `${auth.sub}:${auth.institutionId}:${auth.role}`;
    const last = impersonationSeen.get(key);
    if (last && Date.now() - last < IMPERSONATION_WINDOW_MS) return;
    impersonationSeen.set(key, Date.now());
    void this.eventFromRequest(req, 'SEGURIDAD', 'IMPERSONACION', `El administrador de plataforma operó como ${ROLE_LABEL[auth.role] ?? auth.role} en la institución.`, {
      institutionId: auth.institutionId,
    });
  }

  scopeOf(req: Request): LogScope {
    const platformAdmin = req.auth?.realRole === 'ADMIN' && !req.auth?.impersonated;
    return { platformAdmin, institutionId: platformAdmin ? null : req.auth?.institutionId ?? null };
  }

  async list(kind: LogKind, scope: LogScope, page: PageRequest, params: LogQuery) {
    if (params.from && !DATE.test(params.from)) throw new BadRequestError('La fecha "desde" debe tener el formato AAAA-MM-DD');
    if (params.to && !DATE.test(params.to)) throw new BadRequestError('La fecha "hasta" debe tener el formato AAAA-MM-DD');
    const type = params.type ? params.type.toUpperCase() : null;
    if (type && !LOG_TYPES[kind].includes(type)) throw new BadRequestError('Tipo de registro inválido para esta bitácora');

    const filter: LogFilter = {
      institutionId: scope.platformAdmin ? params.institutionId || null : scope.institutionId,
      from: params.from || null,
      to: params.to || null,
      type,
      q: page.q,
      limit: page.pageSize,
      offset: (page.page - 1) * page.pageSize,
    };
    if (!scope.platformAdmin && !filter.institutionId) throw new BadRequestError('No se pudo determinar la institución');

    if (kind === 'eventos') {
      const { items, total } = await logRepository.listEvents(filter);
      return pageOf(items, total, page);
    }
    if (kind === 'errores') {
      const { items, total } = await logRepository.listErrors(filter);
      return pageOf(scope.platformAdmin ? items : items.map((e) => ({ ...e, stack: null })), total, page);
    }
    const { items, total } = await logRepository.listAudit(filter);
    return pageOf(items, total, page);
  }
}

export const logService = new LogService();
