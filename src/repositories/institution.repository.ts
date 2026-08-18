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
  createdAt: Date;
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
    createdAt: row.createdAt,
  };
}

export interface InstitutionRepository {
  findAll(): Promise<Institution[]>;
  findById(id: string): Promise<Institution | null>;
  findBySlug(slug: string): Promise<Institution | null>;
  create(input: CreateInstitutionInput): Promise<Institution>;
  updateConfig(id: string, input: UpdateInstitutionConfigInput): Promise<Institution>;
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

      const rows = input.enabledAxes
        ? await runQuery<InstitutionRow>('UPDATE "Institution" SET "enabledAxesCsv" = $1 WHERE "id" = $2 RETURNING *', [
            input.enabledAxes.join(','),
            id,
          ])
        : await runQuery<InstitutionRow>('SELECT * FROM "Institution" WHERE "id" = $1', [id]);

      return toDomain(rows[0], { query: runQuery });
    });
  }

  async getAiMonthlyQuota(id: string): Promise<number> {
    const row = await queryOne<{ aiMonthlyQuota: number }>('SELECT "aiMonthlyQuota" FROM "Institution" WHERE "id" = $1', [id]);
    if (!row) throw new Error(`Institution ${id} no encontrada`);
    return row.aiMonthlyQuota;
  }
}

export const institutionRepository = new SqlInstitutionRepository();
