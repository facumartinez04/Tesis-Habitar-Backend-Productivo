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
 * Identificación del alumno según la tesis (§8.3): por defecto con su número de lista;
 * con nombre y apellido sólo si la institución lo habilita. El alumno no crea cuenta ni deja datos de contacto.
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

  if (value.length < 2 || value.length > 80) {
    throw new BadRequestError('Ingresá tu nombre y apellido');
  }
  return { displayName: value, normalized: normalizeStudentName(value) };
}
