import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../src/config/db';

const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "_migrations" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL UNIQUE,
      "applied_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set(
    (await pool.query('SELECT name FROM "_migrations"')).rows.map((r: { name: string }) => r.name),
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] ya aplicada: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO "_migrations" (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[migrate] aplicada: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[migrate] falló ${file}:`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log('[migrate] listo');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
