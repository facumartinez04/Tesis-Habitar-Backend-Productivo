import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';
import type { IssuedRefreshToken } from '../bll/refresh-session.service';

export const REFRESH_COOKIE = 'habitar_refresh';

function baseOptions(): CookieOptions {
  const sameSite = env.refreshCookieSameSite;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite,
    path: '/api/auth',
  };
}

export function readRefreshCookie(req: Request): string | undefined {
  const value = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function setRefreshCookie(res: Response, issued: IssuedRefreshToken): void {
  res.cookie(REFRESH_COOKIE, issued.raw, { ...baseOptions(), expires: issued.expiresAt });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, baseOptions());
}

export const PENDING_LOGIN_COOKIE = 'habitar_ingreso_pendiente';

export function readPendingLoginCookie(req: Request): string | undefined {
  const value = req.cookies?.[PENDING_LOGIN_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function setPendingLoginCookie(res: Response, token: string, days: number): void {
  res.cookie(PENDING_LOGIN_COOKIE, token, { ...baseOptions(), expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000) });
}

export function clearPendingLoginCookie(res: Response): void {
  res.clearCookie(PENDING_LOGIN_COOKIE, baseOptions());
}
