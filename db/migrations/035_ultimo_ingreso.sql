-- Último ingreso de cada usuario. Sirve para mostrar como «Invitación pendiente» a quien fue invitado
-- y todavía no ingresó nunca.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMPTZ;

-- Usuarios que ya ingresaron: se toma la última sesión emitida o el último evento de inicio de sesión.
UPDATE "User" u
SET "lastLoginAt" = GREATEST(
  (SELECT max(r."createdAt") FROM "RefreshToken" r WHERE r."userId" = u."id"),
  (SELECT max(e."createdAt")::timestamptz FROM "EventLog" e WHERE e."userId" = u."id" AND e."type" = 'LOGIN')
)
WHERE u."lastLoginAt" IS NULL;
