import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error';

class TooManyRequestsError extends HttpError {
  constructor(message = 'Demasiados pedidos. Esperá unos minutos y volvé a intentar.') {
    super(429, message);
  }
}

interface Options {
  windowMs: number;
  max: number;
  /** Separa los contadores de cada limitador. */
  name: string;
  /** Por defecto, la IP del cliente (con trust proxy activo en app.ts). */
  key?: (req: Request) => string;
}

/**
 * Limitador de ventana fija en memoria. Alcanza para una instancia única del
 * servidor; si se escala a varias, hay que mover los contadores a un almacén
 * compartido.
 */
export function rateLimit({ windowMs, max, name, key }: Options) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const id = `${name}:${key ? key(req) : req.ip}`;
    const now = Date.now();
    const entry = hits.get(id);

    if (!entry || entry.resetAt <= now) {
      hits.set(id, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      throw new TooManyRequestsError();
    }
    next();
  };
}
