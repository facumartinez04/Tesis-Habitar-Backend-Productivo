CREATE TABLE IF NOT EXISTS "RefreshToken" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "familyId"  TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "rotatedAt" TIMESTAMPTZ,
  "revokedAt" TIMESTAMPTZ,
  "userAgent" TEXT
);

CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken" ("userId");
CREATE INDEX IF NOT EXISTS "RefreshToken_familyId_idx" ON "RefreshToken" ("familyId");
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken" ("expiresAt");
