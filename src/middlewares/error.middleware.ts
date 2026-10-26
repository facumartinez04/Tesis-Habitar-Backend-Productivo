import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error';
import { logService } from '../bll/log.service';
import { InstitutionPausedError } from '../bll/institution-pause';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    if (err.status >= 500) void logService.error(err, { source: 'API', req, status: err.status });
    res.status(err.status).json({ error: err.message, ...(err instanceof InstitutionPausedError ? { institutionPaused: err.pause } : {}) });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues.map((issue) => issue.message).join(', ') });
    return;
  }

  console.error(err);
  void logService.error(err, { source: 'API', req, status: 500 });
  res.status(500).json({ error: 'Error interno del servidor' });
}
