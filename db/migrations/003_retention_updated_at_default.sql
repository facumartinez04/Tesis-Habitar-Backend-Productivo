ALTER TABLE "RetentionPolicy" ALTER COLUMN "updatedAt" SET DEFAULT now();
UPDATE "RetentionPolicy" SET "updatedAt" = now() WHERE "updatedAt" IS NULL;
