import { pool } from '../src/config/db';
import { runMigrations } from '../src/config/migrations';

async function main() {
  const applied = await runMigrations();
  await pool.end();
  console.log(applied.length ? `[migrate] listo: ${applied.length} nuevas` : '[migrate] listo: la base ya estaba al día');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
