import { pool } from '../config/db';
import { env } from '../config/env';

export interface StatusCheck {
  ok: boolean;
  detail?: string;
  latencyMs?: number;
}

export interface StatusReport {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptimeSeconds: number;
  nodeVersion: string;
  checks: {
    database: StatusCheck & { appliedMigrations?: number; lastMigration?: string };
    deepseek: { configured: boolean };
    oauth: {
      google: { configured: boolean };
      microsoft: { configured: boolean };
    };
  };
  config: {
    frontendUrl: string;
    port: number;
  };
}

async function checkDatabase(): Promise<StatusReport['checks']['database']> {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - start;

    let appliedMigrations: number | undefined;
    let lastMigration: string | undefined;
    try {
      const { rows } = await pool.query<{ name: string }>(
        'SELECT name FROM "_migrations" ORDER BY id DESC LIMIT 1',
      );
      const { rows: countRows } = await pool.query<{ count: string }>('SELECT COUNT(*) FROM "_migrations"');
      appliedMigrations = Number(countRows[0]?.count ?? 0);
      lastMigration = rows[0]?.name;
    } catch {

    }

    return { ok: true, latencyMs, appliedMigrations, lastMigration };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'Error de conexión desconocido' };
  }
}

export async function getStatusReport(): Promise<StatusReport> {
  const database = await checkDatabase();

  const checks = {
    database,
    deepseek: { configured: Boolean(env.deepseek.apiKey) },
    oauth: {
      google: { configured: Boolean(env.oauth.google.clientId && env.oauth.google.clientSecret) },
      microsoft: { configured: Boolean(env.oauth.microsoft.clientId && env.oauth.microsoft.clientSecret) },
    },
  };

  const status: StatusReport['status'] = !database.ok ? 'down' : 'ok';

  return {
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
    checks,
    config: {
      frontendUrl: env.frontendUrl,
      port: env.port,
    },
  };
}
