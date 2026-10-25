import fs from 'node:fs';
import path from 'node:path';
import { pool } from './db';

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'db', 'migrations');
const LOCK_KEY = 8_724_163;

export async function runMigrations(): Promise<string[]> {
  const client = await pool.connect();
  const appliedNow: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "applied_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ name: string }>('SELECT name FROM "_migrations"');
    const applied = new Set(rows.map((r) => r.name));
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO "_migrations" (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        appliedNow.push(file);
        console.log(`[migrate] aplicada: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] falló ${file}:`, err);
        throw err;
      }
    }
    return appliedNow;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}
