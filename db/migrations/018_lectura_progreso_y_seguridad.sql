ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "readingMode" TEXT NOT NULL DEFAULT 'LECTURA_PRIMERO'
  CHECK ("readingMode" IN ('LECTURA_PRIMERO', 'DOCENTE_HABILITA', 'LIBRE'));
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "questionsReleasedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ActivityProgress" (
  "id"                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "activityId"         TEXT NOT NULL REFERENCES "Activity"("id") ON DELETE CASCADE,
  "studentKey"         TEXT NOT NULL,
  "studentDisplayName" TEXT NOT NULL,
  "deviceId"           TEXT NOT NULL,
  "phase"              TEXT NOT NULL DEFAULT 'LEYENDO' CHECK ("phase" IN ('LEYENDO', 'RESPONDIENDO', 'ENVIADO')),
  "currentIndex"       INTEGER NOT NULL DEFAULT 0,
  "answeredCount"      INTEGER NOT NULL DEFAULT 0,
  "draftJson"          TEXT,
  "startedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityProgress_activity_student_key" UNIQUE ("activityId", "studentKey")
);
CREATE INDEX IF NOT EXISTS "ActivityProgress_activity_idx" ON "ActivityProgress" ("activityId");

CREATE TABLE IF NOT EXISTS "ActivityIntegrityEvent" (
  "id"                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "activityId"         TEXT NOT NULL REFERENCES "Activity"("id") ON DELETE CASCADE,
  "kind"               TEXT NOT NULL CHECK ("kind" IN ('OTRO_DISPOSITIVO', 'DISPOSITIVO_COMPARTIDO')),
  "studentDisplayName" TEXT NOT NULL,
  "otherStudent"       TEXT,
  "deviceId"           TEXT NOT NULL,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ActivityIntegrityEvent_activity_idx" ON "ActivityIntegrityEvent" ("activityId");
