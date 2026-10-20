ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "showFeedback" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "ActivityTemplate" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "institutionId"    TEXT NOT NULL REFERENCES "Institution"("id") ON DELETE CASCADE,
  "authorId"         TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "authorName"       TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "educationLevel"   TEXT NOT NULL,
  "axis"             TEXT NOT NULL,
  "sourceText"       TEXT NOT NULL,
  "questionsJson"    TEXT NOT NULL,
  "documentFileName" TEXT,
  "documentMimeType" TEXT,
  "documentPagesJson" TEXT,
  "documentData"     BYTEA,
  "uses"             INTEGER NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ActivityTemplate_institution_idx" ON "ActivityTemplate" ("institutionId", "createdAt" DESC);
