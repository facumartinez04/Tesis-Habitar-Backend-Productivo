import { BadRequestError } from '../utils/http-error';
import type { StudentIdMode } from '../domain/institution';

export interface StudentIdentity {
  /** Cómo se guarda y se muestra al docente: «N.º 12» o el nombre ingresado. */
  displayName: string;
  /** Clave de comparación para la vinculación de dispositivos: sin mayúsculas, tildes ni espacios dobles. */
  normalized: string;
}

export function normalizeStudentName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Identificación del alumno: con nombre y apellido (por defecto) o, si la institución lo elige, con su número de
 * lista. El alumno no crea cuenta ni deja datos de contacto.
 */
export function resolveStudentIdentity(mode: StudentIdMode, raw: string | undefined | null): StudentIdentity {
  const value = (raw ?? '').trim().replace(/\s+/g, ' ');

  if (mode === 'LISTA') {
    const match = value.match(/^(?:n\.?\s*[º°o]?\.?\s*|#\s*)?(\d{1,3})$/i);
    const number = match ? Number(match[1]) : NaN;
    if (!Number.isInteger(number) || number < 1 || number > 999) {
      throw new BadRequestError('Ingresá tu número de lista (por ejemplo, 12)');
    }
    const displayName = `N.º ${number}`;
    return { displayName, normalized: normalizeStudentName(displayName) };
  }

  // Nombre y apellido: sólo letras (con tildes, ñ, apóstrofo o guion), al menos dos palabras. Se guarda con
  // mayúscula inicial para que «juan pérez» y «Juan Pérez» sean el mismo alumno y se vean iguales.
  if (value.length < 3 || value.length > 80 || !/^[\p{L}][\p{L}'’\- ]*[\p{L}]$/u.test(value)) {
    throw new BadRequestError('Ingresá tu nombre y apellido, sólo con letras');
  }
  if (value.split(' ').filter((w) => w.length >= 1).length < 2) {
    throw new BadRequestError('Ingresá tu nombre y también tu apellido');
  }
  const displayName = formatStudentName(value);
  return { displayName, normalized: normalizeStudentName(displayName) };
}

/** Mayúscula inicial en cada palabra (y después de guion o apóstrofo): «maría-josé o'neill» → «María-José O'Neill». */
export function formatStudentName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es-AR')
    .replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('es-AR'));
}
