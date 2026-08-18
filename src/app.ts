import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';

export function createApp() {
  const app = express();

  // Coolify (y la mayoría de los hosts) terminan TLS en un proxy y reenvían por HTTP;
  // sin esto, req.protocol siempre da "http" y el redirect_uri de OAuth no matchea
  // el que está registrado en Google/Microsoft (que es https).
  app.set('trust proxy', 1);

  app.use(cors());
  app.use(cookieParser());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
