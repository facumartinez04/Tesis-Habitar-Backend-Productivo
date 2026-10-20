import { query, queryOne } from '../config/db';

export const revokedTokenRepository = {
  async isRevoked(jti: string): Promise<boolean> {
    const row = await queryOne<{ jti: string }>('SELECT "jti" FROM "RevokedToken" WHERE "jti" = $1', [jti]);
    return row !== null;
  },

  async revoke(jti: string, userId: string, expiresAt: Date): Promise<void> {
    await query(
      `INSERT INTO "RevokedToken" ("jti", "userId", "expiresAt") VALUES ($1, $2, $3)
       ON CONFLICT ("jti") DO NOTHING`,
      [jti, userId, expiresAt],
    );
    await query('DELETE FROM "RevokedToken" WHERE "expiresAt" < now()');
  },
};
