import type { NextFunction, Request, Response } from 'express';

const isProd = process.env.NODE_ENV === 'production';

/** Cabeceras de seguridad básicas para una API JSON. */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  if (isProd) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
}
