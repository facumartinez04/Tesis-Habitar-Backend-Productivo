ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "readingMaxChars" INTEGER NOT NULL DEFAULT 5000;
ALTER TABLE "Institution" DROP CONSTRAINT IF EXISTS "Institution_readingMaxChars_check";
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_readingMaxChars_check" CHECK ("readingMaxChars" BETWEEN 500 AND 50000);
