import { activityRepository } from '../repositories/activity.repository';
import { activityService } from '../services/activity.service';

/**
 * Reloj de actividades: cada 30 segundos publica las programadas que llegaron a su hora de inicio y cierra las
 * vencidas (borrando su texto). Antes esto sólo pasaba cuando alguien consultaba la actividad; ahora el aula y
 * el panel del docente se enteran solos, en tiempo real.
 */
const INTERVAL_MS = 30_000;

let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const activities = await activityRepository.findOpenOrScheduled();
    for (const activity of activities) {
      await activityService.syncStatus(activity);
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
