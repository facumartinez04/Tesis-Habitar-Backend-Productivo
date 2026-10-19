import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env';
import { verifyToken } from '../utils/jwt';
import { revokedTokenRepository } from '../repositories/revokedToken.repository';
import { userRepository } from '../repositories/user.repository';
import { activityRepository } from '../repositories/activity.repository';
import { courseRepository } from '../repositories/course.repository';

/**
 * Avisos en tiempo real por WebSocket (Socket.IO). El canal sólo avisa que algo cambió; cada pantalla vuelve a
 * pedir los datos por la API, que sigue siendo la única fuente de verdad y aplica sus controles de acceso.
 *
 * Salas:
 *   course:<id>   público — el aula (QR fijo): se abrió, se cerró o se creó una actividad.
 *   activity:<id> público — la pantalla del alumno: cambió el estado de la actividad.
 *   live:<id>     docente — el panel en vivo: llegó una respuesta, se revisó una corrección, cambió el estado.
 */

let io: Server | null = null;

const MAX_ROOMS_PER_SOCKET = 6;

type Ack = (result: { ok: boolean; error?: string }) => void;

function canJoin(socket: Socket): boolean {
  return socket.rooms.size - 1 < MAX_ROOMS_PER_SOCKET;
}

async function teacherCanWatch(token: string, activityId: string): Promise<boolean> {
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return false;
  }
  if (!payload.jti || (await revokedTokenRepository.isRevoked(payload.jti))) return false;
  const user = await userRepository.findById(payload.sub);
  if (!user || !user.active) return false;
  const activity = await activityRepository.findById(activityId);
  if (!activity) return false;
  if (user.role === 'ADMIN') return true;
  const course = await courseRepository.findById(activity.courseId);
  return Boolean(course && course.institutionId === user.institutionId);
}

export function attachRealtime(server: HttpServer): Server {
  io = new Server(server, {
    path: '/realtime',
    cors: { origin: env.corsOrigins },
    serveClient: false,
  });

  io.on('connection', (socket) => {
    socket.on('watch:course', async (data: { qrCode?: string }, ack?: Ack) => {
      try {
        if (!canJoin(socket) || typeof data?.qrCode !== 'string') return ack?.({ ok: false, error: 'Pedido inválido' });
        const course = await courseRepository.findByQrCode(data.qrCode.trim().toUpperCase());
        if (!course) return ack?.({ ok: false, error: 'Aula no encontrada' });
        await socket.join(`course:${course.id}`);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: 'No se pudo conectar' });
      }
    });

    socket.on('watch:activity', async (data: { code?: string }, ack?: Ack) => {
      try {
        if (!canJoin(socket) || typeof data?.code !== 'string') return ack?.({ ok: false, error: 'Pedido inválido' });
        const activity = await activityRepository.findByCode(data.code.trim().toUpperCase());
        if (!activity) return ack?.({ ok: false, error: 'Actividad no encontrada' });
        await socket.join(`activity:${activity.id}`);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: 'No se pudo conectar' });
      }
    });

    socket.on('watch:live', async (data: { activityId?: string; token?: string }, ack?: Ack) => {
      try {
        if (!canJoin(socket) || typeof data?.activityId !== 'string' || typeof data?.token !== 'string') {
          return ack?.({ ok: false, error: 'Pedido inválido' });
        }
        if (!(await teacherCanWatch(data.token, data.activityId))) return ack?.({ ok: false, error: 'Sin acceso' });
        await socket.join(`live:${data.activityId}`);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: 'No se pudo conectar' });
      }
    });
  });

  return io;
}

export const realtime = {
  /** Cambió el estado o los datos de una actividad (creada, publicada, cerrada). */
  activityChanged(activity: { id: string; courseId: string; status: string }): void {
    if (!io) return;
    io.to(`course:${activity.courseId}`).emit('course:changed');
    io.to(`activity:${activity.id}`).emit('activity:changed', { status: activity.status });
    io.to(`live:${activity.id}`).emit('live:changed');
  },
  /** Pasó la hora de cierre: el aula deja de ofrecer la actividad (los envíos finales todavía entran). */
  courseChanged(courseId: string): void {
    io?.to(`course:${courseId}`).emit('course:changed');
  },
  /** Llegó una respuesta, la IA propuso una corrección o el docente revisó una. */
  liveChanged(activityId: string): void {
    io?.to(`live:${activityId}`).emit('live:changed');
  },
};
