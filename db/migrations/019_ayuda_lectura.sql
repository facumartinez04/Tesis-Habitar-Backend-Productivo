ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "readingHelp" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "ReadingHelpMessage" (
  "id"                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "activityId"         TEXT NOT NULL REFERENCES "Activity"("id") ON DELETE CASCADE,
  "studentKey"         TEXT NOT NULL,
  "studentDisplayName" TEXT NOT NULL,
  "question"           TEXT NOT NULL,
  "answer"             TEXT NOT NULL,
  "declined"           BOOLEAN NOT NULL DEFAULT false,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ReadingHelpMessage_activity_student_idx" ON "ReadingHelpMessage" ("activityId", "studentKey");

ALTER TABLE "AiUsageEvent" DROP CONSTRAINT IF EXISTS "AiUsageEvent_kind_check";
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_kind_check" CHECK ("kind" IN ('GENERACION', 'CORRECCION', 'AYUDA'));
