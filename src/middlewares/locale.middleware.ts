import type { NextFunction, Request, Response } from 'express';
import { localeFromHeaders, type Locale } from '../i18n/locale';
import { translatePayload } from '../i18n/translate';

declare global {
  namespace Express {
    interface Request {
      locale: Locale;
    }
  }
}

export function requestLocale(req: Request, res: Response, next: NextFunction): void {
  req.locale = localeFromHeaders(req.header('x-habitar-language'), req.header('accept-language'));
  res.setHeader('Content-Language', req.locale);
  if (req.locale !== 'es') {
    const json = res.json.bind(res);
    res.json = (body?: unknown) => json(translatePayload(body, req.locale));
  }
  next();
}
