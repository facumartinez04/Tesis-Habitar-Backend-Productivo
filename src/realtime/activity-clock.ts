import { activityRepository } from '../dal/activity.repository';
import { activityService } from '../bll/activity.service';
import { pastEndTime } from '../bll/activity-window';
import { realtime } from './realtime';

const INTERVAL_MS = 30_000;

let running = false;
const endNotified = new Set<string>();

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const activities = await activityRepository.findOpenOrScheduled();
    for (const activity of activities) {
      const updated = await activityService.syncStatus(activity);
      if (updated.status === 'PUBLICADA' && pastEndTime(updated) && !endNotified.has(updated.id)) {
        endNotified.add(updated.id);
        realtime.courseChanged(updated.courseId);
      }
      if (updated.status === 'CERRADA') endNotified.delete(updated.id);
    }
  } catch (err) {
    console.error('[reloj] no se pudo actualizar el estado de las actividades:', (err as Error).message);
  } finally {
    running = false;
  }
}

export function startActivityClock(): NodeJS.Timeout {
  void tick();
  return setInterval(() => void tick(), INTERVAL_MS);
}
