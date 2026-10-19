import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { securityHeaders } from './middlewares/security-headers.middleware';
import { env } from './config/env';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(securityHeaders);
  app.use(
    cors({
      // Sólo el frontend puede llamar a la API desde un navegador. Los pedidos sin
      // Origin (webhooks, monitoreo, herramientas) no pasan por CORS.
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin.replace(/\/$/, ''))) callback(null, true);
        else callback(null, false);
      },
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  if (env.superAdminEmails.length === 0) {
    console.warn('[config] SUPER_ADMIN_EMAILS está vacío: nadie tiene acceso de administrador de la plataforma.');
  }

  return app;
}
