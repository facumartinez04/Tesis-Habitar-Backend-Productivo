CREATE TABLE IF NOT EXISTS "RevokedToken" (
  "jti"       TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "RevokedToken_expiresAt_idx" ON "RevokedToken" ("expiresAt");
