import type { Locale } from './locale';
import { enMessages, enPatterns } from './messages.en';
import { enEventMessages, enEventPatterns } from './events.en';

const allPatterns = [...enPatterns, ...enEventPatterns];

function translateOne(message: string): string | null {
  const exact = enMessages[message] ?? enEventMessages[message];
  if (exact) return exact;
  for (const [pattern, build] of allPatterns) {
    const match = pattern.exec(message);
    if (match) return build(...match.slice(1));
  }
  return null;
}

export function translateMessage(message: string, locale: Locale): string {
  if (locale === 'es' || !message) return message;
  const whole = translateOne(message);
  if (whole) return whole;
  const field = /^([\w.]+): (.+)$/s.exec(message);
  if (field) {
    const rest = translateOne(field[2]);
    if (rest) return `${field[1]}: ${rest}`;
  }
  const parts = message.split(/(?<=[.!?])\s+|, (?=[A-ZÁÉÍÓÚ«])/);
  if (parts.length > 1) {
    const translated = parts.map((part) => translateOne(part) ?? translateOne(part.replace(/\.$/, '')) ?? part);
    if (translated.some((part, i) => part !== parts[i])) return translated.join(' ');
  }
  return message;
}

const TRANSLATABLE_KEYS = new Set(['error', 'message', 'detail', 'scoreLabel', 'description']);

export function translatePayload<T>(payload: T, locale: Locale, depth = 0): T {
  if (locale === 'es' || depth > 6 || payload === null || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) {
    return payload.map((item) => translatePayload(item, locale, depth + 1)) as T;
  }
  if (payload instanceof Date) return payload;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (typeof value === 'string' && TRANSLATABLE_KEYS.has(key)) out[key] = translateMessage(value, locale);
    else if (value && typeof value === 'object') out[key] = translatePayload(value, locale, depth + 1);
    else out[key] = value;
  }
  return out as T;
}
