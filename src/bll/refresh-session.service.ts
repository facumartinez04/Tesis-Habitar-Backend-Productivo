import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { refreshTokenRepository, type RefreshTokenRow } from '../dal/refreshToken.repository';
import { userRepository } from '../dal/user.repository';
import { signToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/http-error';
import { env } from '../config/env';
import { logService } from './log.service';
import type { User } from '../domain/user';

export const ROTATION_GRACE_MS = 30_000;

export interface IssuedRefreshToken {
  raw: string;
  expiresAt: Date;
}

export interface RefreshResult {
  token: string;
  user: User;
  refresh: IssuedRefreshToken | null;
}

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function newRefreshToken(): IssuedRefreshToken {
  return {
    raw: randomBytes(48).toString('base64url'),
    expiresAt: new Date(Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000),
  };
}

function accessTokenFor(user: User): string {
  return signToken({ sub: user.id, role: user.role, institutionId: user.institutionId, provider: user.provider });
}

export type RefreshDecision = 'ROTATE' | 'GRACE' | 'REUSED' | 'REVOKED' | 'EXPIRED';

export function decideRefresh(row: Pick<RefreshTokenRow, 'expiresAt' | 'rotatedAt' | 'revokedAt'>, now = Date.now()): RefreshDecision {
  if (row.expiresAt.getTime() <= now) return 'EXPIRED';
  if (!row.revokedAt) return 'ROTATE';
  if (!row.rotatedAt) return 'REVOKED';
  return now - row.rotatedAt.getTime() <= ROTATION_GRACE_MS ? 'GRACE' : 'REUSED';
}

const SESSION_EXPIRED = 'La sesión expiró. Volvé a ingresar.';

export class RefreshSessionService {
  async issue(userId: string, userAgent: string | null, familyId: string = randomUUID()): Promise<IssuedRefreshToken> {
    const issued = newRefreshToken();
    await refreshTokenRepository.create({
      userId,
      familyId,
      tokenHash: hashRefreshToken(issued.raw),
      expiresAt: issued.expiresAt,
      userAgent: userAgent?.slice(0, 300) ?? null,
    });
    void refreshTokenRepository.purgeExpired().catch(() => undefined);
    return issued;
  }

  async refresh(raw: string | undefined, userAgent: string | null): Promise<RefreshResult> {
    if (!raw) throw new UnauthorizedError(SESSION_EXPIRED);
    const row = await refreshTokenRepository.findByHash(hashRefreshToken(raw));
    if (!row) throw new UnauthorizedError(SESSION_EXPIRED);

    const decision = decideRefresh(row);
    if (decision === 'EXPIRED' || decision === 'REVOKED') throw new UnauthorizedError(SESSION_EXPIRED);
    if (decision === 'REUSED') {
      await refreshTokenRepository.revokeFamily(row.familyId);
      await this.logReuse(row.userId);
      throw new UnauthorizedError(SESSION_EXPIRED);
    }

    const user = await userRepository.findById(row.userId);
    if (!user || !user.active) {
      await refreshTokenRepository.revokeFamily(row.familyId);
      throw new UnauthorizedError('La cuenta fue desactivada');
    }

    if (decision === 'GRACE') return this.withinGrace(row.familyId, user);

    const next = newRefreshToken();
    const rotated = await refreshTokenRepository.rotate(row, {
      tokenHash: hashRefreshToken(next.raw),
      expiresAt: next.expiresAt,
      userAgent: userAgent?.slice(0, 300) ?? null,
    });
    if (!rotated) return this.withinGrace(row.familyId, user);
    return { token: accessTokenFor(user), user, refresh: next };
  }

  async revoke(raw: string | undefined): Promise<void> {
    if (!raw) return;
    const row = await refreshTokenRepository.findByHash(hashRefreshToken(raw));
    if (row) await refreshTokenRepository.revokeFamily(row.familyId);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await refreshTokenRepository.revokeAllForUser(userId);
  }

  private async withinGrace(familyId: string, user: User): Promise<RefreshResult> {
    if (!(await refreshTokenRepository.familyIsActive(familyId))) throw new UnauthorizedError(SESSION_EXPIRED);
    return { token: accessTokenFor(user), user, refresh: null };
  }

  private async logReuse(userId: string): Promise<void> {
    const user = await userRepository.findById(userId);
    void logService.event({
      actor: {
        userId,
        role: user?.role ?? null,
        institutionId: user?.institutionId ?? null,
        impersonated: false,
        userName: user?.name ?? null,
        userEmail: user?.email ?? null,
      },
      institutionId: user?.institutionId ?? null,
      category: 'SEGURIDAD',
      type: 'SESION_REUTILIZADA',
      description: 'Se reutilizó un token de sesión ya renovado: se cerró la sesión en ese dispositivo.',
    });
  }
}

export const refreshSessionService = new RefreshSessionService();
