-- Prisma manejaba "updatedAt" (@updatedAt) del lado del cliente; sin Prisma,
-- la columna quedó NOT NULL sin default y rompía cualquier INSERT nuevo.
ALTER TABLE "RetentionPolicy" ALTER COLUMN "updatedAt" SET DEFAULT now();
UPDATE "RetentionPolicy" SET "updatedAt" = now() WHERE "updatedAt" IS NULL;
