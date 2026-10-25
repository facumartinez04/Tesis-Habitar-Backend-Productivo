ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "defaultLanguage" TEXT NOT NULL DEFAULT 'es';
ALTER TABLE "Institution" DROP CONSTRAINT IF EXISTS "Institution_defaultLanguage_check";
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_defaultLanguage_check" CHECK ("defaultLanguage" IN ('es', 'en'));

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT;
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_language_check";
ALTER TABLE "User" ADD CONSTRAINT "User_language_check" CHECK ("language" IS NULL OR "language" IN ('es', 'en'));

ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'es';
ALTER TABLE "Activity" DROP CONSTRAINT IF EXISTS "Activity_language_check";
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_language_check" CHECK ("language" IN ('es', 'en'));

ALTER TABLE "ActivityTemplate" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'es';
