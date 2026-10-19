-- Migración 015: lo que la tesis promete y el producto todavía no hacía.
--   * Identificación del alumno por número de lista (por defecto) o por nombre, si la institución lo habilita (§8.3).
--   * Umbral de alertas configurable y preferencia de correo (CU-03-03).
--   * Actividades diagnósticas de inicio y cierre del ciclo (mejora 1).
--   * Consumo de IA separado entre generación de preguntas y corrección de respuestas abiertas (mejora 4).
--   * El texto fuente se conserva sólo mientras la actividad está abierta (§8.3 y §8.4).

ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "studentIdMode" TEXT NOT NULL DEFAULT 'LISTA'
  CHECK ("studentIdMode" IN ('LISTA', 'NOMBRE'));
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "alertThreshold" INTEGER NOT NULL DEFAULT 60
  CHECK ("alertThreshold" BETWEEN 0 AND 100);
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "alertEmailsEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "diagnosticType" TEXT
  CHECK ("diagnosticType" IN ('INICIO', 'CIERRE'));
ALTER TABLE "Activity" ALTER COLUMN "sourceText" DROP NOT NULL;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "sourcePurgedAt" TIMESTAMP(3);

ALTER TABLE "AiUsageEvent" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'GENERACION'
  CHECK ("kind" IN ('GENERACION', 'CORRECCION'));

-- Fecha en que la alerta dejó de aplicar (el curso volvió a superar el umbral).
ALTER TABLE "PerformanceAlert" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "PerformanceAlert_course_axis_idx" ON "PerformanceAlert" ("courseId", "axis");

CREATE INDEX IF NOT EXISTS "Answer_response_idx" ON "Answer" ("responseId");
CREATE INDEX IF NOT EXISTS "StudentResult_activity_idx" ON "StudentResult" ("activityId");
