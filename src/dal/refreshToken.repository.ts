import { query, queryOne, withTransaction } from '../config/db';

export interface RefreshTokenRow {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

const COLUMNS = '"id", "userId", "familyId", "expiresAt", "rotatedAt", "revokedAt"';

export const refreshTokenRepository = {
  async create(input: { userId: string; familyId: string; tokenHash: string; expiresAt: Date; userAgent: string | null }): Promise<void> {
    await query(
      `INSERT INTO "RefreshToken" ("userId", "familyId", "tokenHash", "expiresAt", "userAgent") VALUES ($1, $2, $3, $4, $5)`,
      [input.userId, input.familyId, input.tokenHash, input.expiresAt, input.userAgent],
    );
  },

  async findByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    return queryOne<RefreshTokenRow>(`SELECT ${COLUMNS} FROM "RefreshToken" WHERE "tokenHash" = $1`, [tokenHash]);
  },

  async rotate(
    current: RefreshTokenRow,
    next: { tokenHash: string; expiresAt: Date; userAgent: string | null },
  ): Promise<boolean> {
    return withTransaction(async (client) => {
      const { rowCount } = await client.query(
        `UPDATE "RefreshToken" SET "rotatedAt" = now(), "revokedAt" = now()
          WHERE "id" = $1 AND "revokedAt" IS NULL`,
        [current.id],
      );
      if (rowCount !== 1) return false;
      await client.query(
        `INSERT INTO "RefreshToken" ("userId", "familyId", "tokenHash", "expiresAt", "userAgent") VALUES ($1, $2, $3, $4, $5)`,
        [current.userId, current.familyId, next.tokenHash, next.expiresAt, next.userAgent],
      );
      return true;
    });
  },

  async familyIsActive(familyId: string): Promise<boolean> {
    const row = await queryOne<{ id: string }>(
      `SELECT "id" FROM "RefreshToken" WHERE "familyId" = $1 AND "revokedAt" IS NULL AND "expiresAt" > now() LIMIT 1`,
      [familyId],
    );
    return row !== null;
  },

  async revokeFamily(familyId: string): Promise<void> {
    await query(`UPDATE "RefreshToken" SET "revokedAt" = now() WHERE "familyId" = $1 AND "revokedAt" IS NULL`, [familyId]);
  },

  async revokeAllForUser(userId: string): Promise<void> {
    await query(`UPDATE "RefreshToken" SET "revokedAt" = now() WHERE "userId" = $1 AND "revokedAt" IS NULL`, [userId]);
  },

  async purgeExpired(): Promise<void> {
    await query(`DELETE FROM "RefreshToken" WHERE "expiresAt" < now() - interval '7 days'`);
  },
};
