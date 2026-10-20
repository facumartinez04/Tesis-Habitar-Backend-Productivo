import { query, queryOne } from '../config/db';
import type { AuditLogListEntry, ErrorLogEntry, EventLogEntry, LogFilter, NewError, NewEvent } from '../domain/log';

interface Where {
  sql: string;
  params: unknown[];
}

function buildWhere(alias: string, dateColumn: string, filter: LogFilter, searchColumns: string[], typeColumn: string): Where {
  const parts: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    parts.push(sql.replace('?', `$${params.length}`));
  };
  if (filter.institutionId) add(`${alias}."institutionId" = ?`, filter.institutionId);
  if (filter.from) add(`${alias}."${dateColumn}" >= ?::date`, filter.from);
  if (filter.to) add(`${alias}."${dateColumn}" < (?::date + INTERVAL '1 day')`, filter.to);
  if (filter.type) add(`${alias}.${typeColumn} = ?`, filter.type);
  if (filter.q) {
    params.push(filter.q);
    const n = params.length;
    parts.push(`(${searchColumns.map((c) => `COALESCE(${c}, '') ILIKE '%' || $${n} || '%'`).join(' OR ')})`);
  }
  return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
}

async function paged<T>(select: string, from: string, where: Where, order: string, filter: LogFilter): Promise<{ items: T[]; total: number }> {
  const n = where.params.length;
  const [rows, count] = await Promise.all([
    query(`${select} ${from} ${where.sql} ORDER BY ${order} LIMIT $${n + 1} OFFSET $${n + 2}`, [...where.params, filter.limit, filter.offset]),
    queryOne<{ total: string }>(`SELECT COUNT(*) AS "total" ${from} ${where.sql}`, where.params),
  ]);
  return { items: rows as T[], total: Number(count?.total ?? 0) };
}

export class SqlLogRepository {
  async insertEvent(event: NewEvent): Promise<void> {
    await query(
      `INSERT INTO "EventLog" ("institutionId", "userId", "userName", "userEmail", "role", "impersonated", "category", "type", "entityId", "description")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        event.institutionId,
        event.actor.userId,
        event.actor.userName ?? null,
        event.actor.userEmail ?? null,
        event.actor.role,
        event.actor.impersonated,
        event.category,
        event.type,
        event.entityId ?? null,
        event.description.slice(0, 1000),
      ],
    );
  }

  async insertError(error: NewError & { userEmail: string | null }): Promise<void> {
    await query(
      `INSERT INTO "ErrorLog" ("source", "institutionId", "userId", "userEmail", "role", "method", "path", "status", "message", "stack")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        error.source,
        error.institutionId,
        error.userId,
        error.userEmail,
        error.role,
        error.method,
        error.path?.slice(0, 500) ?? null,
        error.status,
        error.message.slice(0, 1000),
        error.stack?.slice(0, 4000) ?? null,
      ],
    );
  }

  async institutionIdForActivityCode(code: string): Promise<string | null> {
    const row = await queryOne<{ institutionId: string }>(
      `SELECT c."institutionId" FROM "Activity" a JOIN "Course" c ON c."id" = a."courseId" WHERE a."code" = $1`,
      [code],
    );
    return row?.institutionId ?? null;
  }

  async listEvents(filter: LogFilter) {
    const where = buildWhere('e', 'createdAt', filter, ['e."description"', 'e."userName"', 'e."userEmail"', 'e."type"'], '"category"');
    return paged<EventLogEntry>(
      `SELECT e."id", e."createdAt", e."institutionId", i."name" AS "institutionName", e."userId", e."userName", e."userEmail",
              e."role", e."impersonated", e."category", e."type", e."entityId", e."description"`,
      `FROM "EventLog" e LEFT JOIN "Institution" i ON i."id" = e."institutionId"`,
      where,
      'e."createdAt" DESC',
      filter,
    );
  }

  async listErrors(filter: LogFilter) {
    const where = buildWhere('e', 'createdAt', filter, ['e."message"', 'e."path"', 'e."userEmail"'], '"source"');
    return paged<ErrorLogEntry>(
      `SELECT e."id", e."createdAt", e."source", e."institutionId", i."name" AS "institutionName", e."userId", e."userEmail",
              e."role", e."method", e."path", e."status", e."message", e."stack"`,
      `FROM "ErrorLog" e LEFT JOIN "Institution" i ON i."id" = e."institutionId"`,
      where,
      'e."createdAt" DESC',
      filter,
    );
  }

  async listAudit(filter: LogFilter) {
    const where = buildWhere('a', 'date', filter, ['a."studentName"', 'a."performedBy"'], '"operation"::text');
    return paged<AuditLogListEntry>(
      `SELECT a."id", a."date", a."institutionId", i."name" AS "institutionName", a."studentName", a."operation"::text AS "operation", a."performedBy"`,
      `FROM "AuditLogEntry" a LEFT JOIN "Institution" i ON i."id" = a."institutionId"`,
      where,
      'a."date" DESC',
      filter,
    );
  }
}

export const logRepository = new SqlLogRepository();
