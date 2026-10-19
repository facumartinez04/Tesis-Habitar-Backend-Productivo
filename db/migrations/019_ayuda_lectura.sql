-- Migración 019: ayuda con el texto. Cada alumno puede preguntarle a la IA qué significa una palabra, una expresión
-- o una oración del texto, sin que le responda las preguntas de la actividad. El docente ve las dudas en el panel.

-- El docente decide por actividad si los alumnos tienen la ayuda (por defecto, sí).
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "readingHelp" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "ReadingHelpMessage" (
  "id"                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "activityId"         TEXT NOT NULL REFERENCES "Activity"("id") ON DELETE CASCADE,
  "studentKey"         TEXT NOT NULL,
  "studentDisplayName" TEXT NOT NULL,
  "question"           TEXT NOT NULL,
  "answer"             TEXT NOT NULL,
  -- true si la IA no respondió porque la pregunta buscaba la respuesta de la actividad o no era sobre el texto.
  "declined"           BOOLEAN NOT NULL DEFAULT false,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ReadingHelpMessage_activity_student_idx" ON "ReadingHelpMessage" ("activityId", "studentKey");

-- El uso de la IA para la ayuda se registra aparte: no consume la cuota mensual de generación de preguntas.
ALTER TABLE "AiUsageEvent" DROP CONSTRAINT IF EXISTS "AiUsageEvent_kind_check";
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_kind_check" CHECK ("kind" IN ('GENERACION', 'CORRECCION', 'AYUDA'));
