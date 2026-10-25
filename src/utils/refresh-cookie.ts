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
