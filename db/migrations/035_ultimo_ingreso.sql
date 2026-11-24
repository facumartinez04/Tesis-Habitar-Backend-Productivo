ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMPTZ;

UPDATE "User" u
SET "lastLoginAt" = GREATEST(
  (SELECT max(r."createdAt") FROM "RefreshToken" r WHERE r."userId" = u."id"),
  (SELECT max(e."createdAt")::timestamptz FROM "EventLog" e WHERE e."userId" = u."id" AND e."type" = 'LOGIN')
)
WHERE u."lastLoginAt" IS NULL;
