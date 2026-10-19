import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { attachRealtime } from './realtime/realtime';
import { startActivityClock } from './realtime/activity-clock';

const app = createApp();
const server = createServer(app);

// WebSocket en /realtime: avisos en vivo para el aula, el alumno y el panel del docente.
attachRealtime(server);
startActivityClock();

server.listen(env.port, () => {
  console.log(`Habitar API escuchando en http://localhost:${env.port}`);
});
