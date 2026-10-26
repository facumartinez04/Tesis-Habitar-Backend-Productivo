import { query, queryOne } from '../config/db';
import { HttpError, NotFoundError } from '../utils/http-error';

export interface InstitutionPause {
  pausedAt: string;
  reason: string | null;
}

export const STAFF_PAUSED_MESSAGE = 'La cuenta de tu institución está pausada. Comunicate con Habitar para reactivarla.';
export const STUDENT_PAUSED_MESSAGE = 'La cuenta de esta institución está pausada por el momento. Consultá con tu docente.';

export class InstitutionPausedError extends HttpError {
  constructor(message: string, readonly pause: InstitutionPause) {
    super(423, message);
    this.name = 'InstitutionPausedError';
  }
}

export async function getInstitutionPause(institutionId: string): Promise<InstitutionPause | null> {
  const row = await queryOne<{ pausedAt: Date | null; pauseReason: string | null }>(
    'SELECT "pausedAt", "pauseReason" FROM "Institution" WHERE "id" = $1',
    [institutionId],
  );
  if (!row?.pausedAt) return null;
  return { pausedAt: row.pausedAt.toISOString(), reason: row.pauseReason };
}

export async function assertInstitutionActive(institutionId: string, audience: 'staff' | 'student'): Promise<void> {
  const pause = await getInstitutionPause(institutionId);
  if (pause) throw new InstitutionPausedError(audience === 'staff' ? STAFF_PAUSED_MESSAGE : STUDENT_PAUSED_MESSAGE, pause);
}

export async function setInstitutionPause(institutionId: string, paused: boolean, reason: string | null): Promise<InstitutionPause | null> {
  const rows = await query<{ id: string }>(
    `UPDATE "Institution"
        SET "pausedAt" = CASE WHEN $2 THEN COALESCE("pausedAt", now()) ELSE NULL END,
            "pauseReason" = CASE WHEN $2 THEN $3 ELSE NULL END
      WHERE "id" = $1
      RETURNING "id"`,
    [institutionId, paused, reason?.trim().slice(0, 300) || null],
  );
  if (!rows.length) throw new NotFoundError('Institución no encontrada');
  return getInstitutionPause(institutionId);
}
