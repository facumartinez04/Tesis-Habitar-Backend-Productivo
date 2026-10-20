import type { Activity } from '../domain/activity';

const AR_OFFSET = '-03:00';

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

export type WindowFields = Pick<Activity, 'availableFrom' | 'startTime' | 'endTime'> & { endDate?: string | null };

export function activityWindow(activity: WindowFields): ActivityWindow {
  const opensAt = at(activity.availableFrom, activity.startTime);
  const closesAt = at(activity.endDate || activity.availableFrom, activity.endTime);
  if (opensAt && closesAt && closesAt.getTime() <= opensAt.getTime()) return { opensAt, closesAt: null };
  return { opensAt, closesAt };
}

export function hasClosed(activity: WindowFields, now = Date.now()): boolean {
  const { closesAt } = activityWindow(activity);
  return closesAt !== null && now > closesAt.getTime() + SUBMIT_GRACE_MS;
}

export function hasOpened(activity: WindowFields, now = Date.now()): boolean {
  const { opensAt } = activityWindow(activity);
  if (opensAt) return now >= opensAt.getTime();
  const day = new Date(`${activity.availableFrom}T00:00:00${AR_OFFSET}`);
  return Number.isNaN(day.getTime()) || now >= day.getTime();
}

export function pastEndTime(activity: WindowFields, now = Date.now()): boolean {
  const { closesAt } = activityWindow(activity);
  return closesAt !== null && now > closesAt.getTime();
}
