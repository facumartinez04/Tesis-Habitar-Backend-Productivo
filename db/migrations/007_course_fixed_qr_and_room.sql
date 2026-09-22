-- Migración 007: QR fijo permanente y datos de salón/división para Course / Aula

ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "qrCode" TEXT,
  ADD COLUMN IF NOT EXISTS "room" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "grade" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "division" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "shift" TEXT DEFAULT 'MAÑANA',
  ADD COLUMN IF NOT EXISTS "activeActivityId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now();

-- Generar qrCode único para cursos existentes que no lo tengan
UPDATE "Course"
   SET "qrCode" = 'AULA-' || UPPER(SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 6))
 WHERE "qrCode" IS NULL;

-- Asegurar constraint NOT NULL y UNIQUE en qrCode
ALTER TABLE "Course"
  ALTER COLUMN "qrCode" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Course_qrCode_key'
  ) THEN
    ALTER TABLE "Course" ADD CONSTRAINT "Course_qrCode_key" UNIQUE ("qrCode");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_course_qr_code" ON "Course"("qrCode");
