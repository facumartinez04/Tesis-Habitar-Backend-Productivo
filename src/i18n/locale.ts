export const LOCALES = ['es', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'es';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function toLocale(value: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
  if (typeof value !== 'string') return fallback;
  const base = value.trim().toLowerCase().slice(0, 2);
  return isLocale(base) ? base : fallback;
}

export function localeFromHeaders(explicit: string | undefined, acceptLanguage: string | undefined): Locale {
  if (explicit && isLocale(explicit.trim().toLowerCase())) return explicit.trim().toLowerCase() as Locale;
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return { tag: tag.trim().toLowerCase().slice(0, 2), q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  const match = ranked.find((r) => isLocale(r.tag));
  return match ? (match.tag as Locale) : DEFAULT_LOCALE;
}
