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

ALTER TABLE "PerformanceAlert" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "PerformanceAlert_course_axis_idx" ON "PerformanceAlert" ("courseId", "axis");

CREATE INDEX IF NOT EXISTS "Answer_response_idx" ON "Answer" ("responseId");
CREATE INDEX IF NOT EXISTS "StudentResult_activity_idx" ON "StudentResult" ("activityId");
