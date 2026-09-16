import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseUrl.includes('sslmode=require') || env.databaseUrl.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

pool.on('connect', async (client) => {
  await client.query('SET search_path TO public, service');
});

pool.on('error', (err) => {
  console.error('[db] error inesperado en cliente idle de PostgreSQL', err);
});

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
