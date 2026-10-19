-- Migración 018: lectura previa, progreso en vivo de cada alumno y avisos de posible suplantación.

-- Cómo empieza el alumno: LECTURA_PRIMERO (por defecto: lee y después pasa a las preguntas),
-- DOCENTE_HABILITA (las preguntas se habilitan cuando el docente lo indica) o LIBRE (texto y preguntas juntos).
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "readingMode" TEXT NOT NULL DEFAULT 'LECTURA_PRIMERO'
  CHECK ("readingMode" IN ('LECTURA_PRIMERO', 'DOCENTE_HABILITA', 'LIBRE'));
-- Momento en que el docente pasó a todos a las preguntas.
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "questionsReleasedAt" TIMESTAMP(3);

-- Progreso de cada alumno mientras responde (borrador incluido): el panel del docente lo ve en vivo y el
-- alumno puede retomar desde donde estaba (CU-01-04).
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

-- Avisos de integridad: el mismo alumno desde otro celular, o un celular que responde por varios alumnos.
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
