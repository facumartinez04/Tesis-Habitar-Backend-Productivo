import type { Activity } from '../domain/activity';

/** Argentina no tiene horario de verano: la hora de las actividades es siempre UTC−3. */
const AR_OFFSET = '-03:00';

/**
 * Tolerancia después del cierre: el alumno al que se le vence la ventana mientras responde
 * envía automáticamente sus respuestas parciales (CU-02-06, flujo 2.1), y ese envío tiene que entrar.
 */
export const SUBMIT_GRACE_MS = 10 * 60 * 1000;

function at(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}:00${AR_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export interface ActivityWindow {
  opensAt: Date | null;
  closesAt: Date | null;
}

/** Ventana de la actividad: la fecha de disponibilidad, entre la hora de inicio y la de cierre (CU-02-04). */
export function activityWindow(activity: Pick<Activity, 'availableFrom' | 'startTime' | 'endTime'>): ActivityWindow {
  const opensAt = at(activity.availableFrom, activity.startTime);
  const closesAt = at(activity.availableFrom, activity.endTime);
  if (opensAt && closesAt && closesAt.getTime() <= opensAt.getTime()) return { opensAt, closesAt: null };
  return { opensAt, closesAt };
}

export function hasClosed(activity: Pick<Activity, 'availableFrom' | 'startTime' | 'endTime'>, now = Date.now()): boolean {
  const { closesAt } = activityWindow(activity);
  return closesAt !== null && now > closesAt.getTime() + SUBMIT_GRACE_MS;
}

export function hasOpened(activity: Pick<Activity, 'availableFrom' | 'startTime' | 'endTime'>, now = Date.now()): boolean {
  const { opensAt } = activityWindow(activity);
  if (opensAt) return now >= opensAt.getTime();
  // Sin hora válida, alcanza con que haya llegado el día.
  const day = new Date(`${activity.availableFrom}T00:00:00${AR_OFFSET}`);
  return Number.isNaN(day.getTime()) || now >= day.getTime();
}

/** Pasó la hora de cierre: ya no se puede empezar la actividad, aunque todavía entren los envíos finales. */
export function pastEndTime(activity: Pick<Activity, 'availableFrom' | 'startTime' | 'endTime'>, now = Date.now()): boolean {
  const { closesAt } = activityWindow(activity);
  return closesAt !== null && now > closesAt.getTime();
}
