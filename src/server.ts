import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { attachRealtime } from './realtime/realtime';
import { startActivityClock } from './realtime/activity-clock';
import { logService } from './bll/log.service';
import { runMigrations } from './config/migrations';

process.on('unhandledRejection', (reason) => {
  console.error('[proceso] promesa rechazada sin manejar', reason);
  void logService.error(reason, { source: 'PROCESO' });
});

process.on('uncaughtException', (err) => {
  console.error('[proceso] excepción no capturada', err);
  void logService.error(err, { source: 'PROCESO' }).finally(() => process.exit(1));
});

async function start(): Promise<void> {
  await runMigrations();

  const app = createApp();
  const server = createServer(app);

  attachRealtime(server);
  startActivityClock();

  server.listen(env.port, () => {
    console.log(`Habitar API escuchando en http://localhost:${env.port}`);
  });
}

start().catch((err) => {
  console.error('[inicio] no se pudo aplicar las migraciones de la base', err);
  process.exit(1);
});
