import type { PoolClient, QueryResultRow } from 'pg';
import { query, queryOne, withTransaction } from '../config/db';
import type { CreateInstitutionInput, Institution, UpdateInstitutionConfigInput } from '../domain/institution';
import type { ComprehensionAxis, EducationLevel } from '../domain/enums';

interface InstitutionRow {
  id: string;
  slug: string;
  name: string;
  domain: string;
  status: Institution['status'];
  coordinatorEmail: string;
  enabledAxesCsv: string;
  aiMonthlyQuota: number;
  aiProvider?: string | null;
  aiKeySource?: string | null;
  aiCustomApiKey?: string | null;
  aiModel?: string | null;
  createdAt: Date;
}

function maskApiKey(key: string | null | undefined): string | null {
  if (!key || key.trim() === '') return null;
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

function parseAxes(csv: string): ComprehensionAxis[] {
  return csv
    .split(',')
    .map((axis) => axis.trim())
    .filter((axis): axis is ComprehensionAxis => axis === 'LITERAL' || axis === 'INFERENCIAL' || axis === 'CRITICO');
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function toDomain(row: InstitutionRow, runner: { query: typeof query } = { query }): Promise<Institution> {
  const levels = await runner.query<{ level: EducationLevel }>('SELECT "level" FROM "InstitutionLevel" WHERE "institutionId" = $1', [row.id]);
  const rawKey = row.aiCustomApiKey ?? null;
  const provider = (row.aiProvider === 'OPENAI' ? 'OPENAI' : 'DEEPSEEK') as 'DEEPSEEK' | 'OPENAI';
  const keySource = (row.aiKeySource === 'CUSTOM' ? 'CUSTOM' : 'PLATFORM') as 'PLATFORM' | 'CUSTOM';

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    domain: row.domain,
    status: row.status,
    coordinatorEmail: row.coordinatorEmail,
    levels: levels.map((l) => l.level),
    enabledAxes: parseAxes(row.enabledAxesCsv),
    aiMonthlyQuota: row.aiMonthlyQuota,
    aiProvider: provider,
    aiKeySource: keySource,
    aiCustomApiKey: rawKey,
    aiCustomApiKeyMasked: maskApiKey(rawKey),
    hasCustomApiKey: Boolean(rawKey && rawKey.trim().length > 0),
    aiModel: row.aiModel ?? null,
    createdAt: row.createdAt,
  };
}

export interface InstitutionRepository {
  findAll(): Promise<Institution[]>;
  findById(id: string): Promise<Institution | null>;
  findBySlug(slug: string): Promise<Institution | null>;

  findByDomain(domain: string): Promise<Institution | null>;
  create(input: CreateInstitutionInput): Promise<Institution>;
  updateConfig(id: string, input: UpdateInstitutionConfigInput): Promise<Institution>;
  updateStatus(id: string, status: Institution['status']): Promise<Institution>;
  getAiMonthlyQuota(id: string): Promise<number>;
}

export class SqlInstitutionRepository implements InstitutionRepository {
  async findAll(): Promise<Institution[]> {
    const rows = await query<InstitutionRow>('SELECT * FROM "Institution" ORDER BY "createdAt" DESC');
    return Promise.all(rows.map((r) => toDomain(r)));
  }

  async findById(id: string): Promise<Institution | null> {
    const row = await queryOne<InstitutionRow>('SELECT * FROM "Institution" WHERE "id" = $1', [id]);
    return row ? toDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<Institution | null> {
    const row = await queryOne<InstitutionRow>('SELECT * FROM "Institution" WHERE "slug" = $1', [slug]);
    return row ? toDomain(row) : null;
  }

  async findByDomain(domain: string): Promise<Institution | null> {
    const row = await queryOne<InstitutionRow>('SELECT * FROM "Institution" WHERE lower("domain") = lower($1)', [domain]);
    return row ? toDomain(row) : null;
  }

  async create(input: CreateInstitutionInput): Promise<Institution> {
    const baseSlug = slugify(input.name);
    const existingCount = await queryOne<{ count: string }>(
      'SELECT COUNT(*) FROM "Institution" WHERE "slug" LIKE $1 || \'%\'',
      [baseSlug],
    );
    const count = Number(existingCount?.count ?? 0);
    const slug = count > 0 ? `${baseSlug}-${count + 1}` : baseSlug;

    return withTransaction(async (client) => {
      const { rows } = await client.query<InstitutionRow>(
        `INSERT INTO "Institution" ("name", "slug", "domain", "status", "coordinatorEmail")
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.name, slug, input.domain, input.status, input.coordinatorEmail],
      );
      const institution = rows[0];

      for (const level of input.levels) {
        await client.query('INSERT INTO "InstitutionLevel" ("institutionId", "level") VALUES ($1, $2)', [institution.id, level]);
      }

      return toDomain(institution, { query: (text, params) => client.query(text, params).then((r) => r.rows) });
    });
  }

  async updateConfig(id: string, input: UpdateInstitutionConfigInput): Promise<Institution> {
    return withTransaction(async (client) => {
      if (input.levels) {
        await client.query('DELETE FROM "InstitutionLevel" WHERE "institutionId" = $1', [id]);
        for (const level of input.levels) {
          await client.query('INSERT INTO "InstitutionLevel" ("institutionId", "level") VALUES ($1, $2)', [id, level]);
        }
      }

      const runQuery = <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) =>
        (client as PoolClient).query<T>(text, params).then((r) => r.rows);

      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (input.enabledAxes) {
        updates.push(`"enabledAxesCsv" = $${paramIndex++}`);
        values.push(input.enabledAxes.join(','));
      }

      if (input.aiProvider) {
        updates.push(`"aiProvider" = $${paramIndex++}`);
        values.push(input.aiProvider);
      }

      if (input.aiKeySource) {
        updates.push(`"aiKeySource" = $${paramIndex++}`);
        values.push(input.aiKeySource);
      }

      if (input.aiCustomApiKey !== undefined) {
        if (input.aiCustomApiKey === null || input.aiCustomApiKey.trim() === '') {
          updates.push(`"aiCustomApiKey" = $${paramIndex++}`);
          values.push(null);
        } else if (!input.aiCustomApiKey.includes('••••')) {
          updates.push(`"aiCustomApiKey" = $${paramIndex++}`);
          values.push(input.aiCustomApiKey.trim());
        }
      }

      if (input.aiModel !== undefined) {
        updates.push(`"aiModel" = $${paramIndex++}`);
        values.push(input.aiModel ? input.aiModel.trim() : null);
      }

      let rows: InstitutionRow[];
      if (updates.length > 0) {
        values.push(id);
        const queryText = `UPDATE "Institution" SET ${updates.join(', ')} WHERE "id" = $${paramIndex} RETURNING *`;
        rows = await runQuery<InstitutionRow>(queryText, values);
      } else {
        rows = await runQuery<InstitutionRow>('SELECT * FROM "Institution" WHERE "id" = $1', [id]);
      }

      return toDomain(rows[0], { query: runQuery });
    });
  }

  async updateStatus(id: string, status: Institution['status']): Promise<Institution> {
    const row = await queryOne<InstitutionRow>('UPDATE "Institution" SET "status" = $1 WHERE "id" = $2 RETURNING *', [status, id]);
    if (!row) throw new Error(`Institution ${id} no encontrada`);
    return toDomain(row);
  }

  async getAiMonthlyQuota(id: string): Promise<number> {
    const row = await queryOne<{ aiMonthlyQuota: number }>('SELECT "aiMonthlyQuota" FROM "Institution" WHERE "id" = $1', [id]);
    if (!row) throw new Error(`Institution ${id} no encontrada`);
    return row.aiMonthlyQuota;
  }
}

export const institutionRepository = new SqlInstitutionRepository();
