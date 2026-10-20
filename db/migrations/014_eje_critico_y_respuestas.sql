ALTER TABLE "Answer" ALTER COLUMN "selectedOption" DROP NOT NULL;
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "textAnswer"   TEXT;
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "aiScore"      INTEGER CHECK ("aiScore" BETWEEN 0 AND 3);
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "aiRationale"  TEXT;
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "teacherScore" INTEGER CHECK ("teacherScore" BETWEEN 0 AND 3);
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "reviewedAt"   TIMESTAMP(3);
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;

ALTER TABLE "StudentResult" ALTER COLUMN "literalScore"     DROP NOT NULL;
ALTER TABLE "StudentResult" ALTER COLUMN "inferencialScore" DROP NOT NULL;
ALTER TABLE "StudentResult" ALTER COLUMN "criticoScore"     DROP NOT NULL;
ALTER TABLE "StudentResult" ADD COLUMN IF NOT EXISTS "criticoReviewed" BOOLEAN NOT NULL DEFAULT false;

UPDATE "StudentResult" sr
   SET "criticoScore" = NULL
 WHERE sr."criticoScore" = 50
   AND NOT EXISTS (
     SELECT 1 FROM "Question" q
      WHERE q."activityId" = sr."activityId" AND q."axis" = 'CRITICO' AND q."correctOption" IS NOT NULL
   );

ALTER TABLE "Response" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;

CREATE INDEX IF NOT EXISTS "Response_activity_student_idx" ON "Response" ("activityId", "studentId");
