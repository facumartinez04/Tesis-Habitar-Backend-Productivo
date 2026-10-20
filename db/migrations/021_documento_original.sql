CREATE TABLE IF NOT EXISTS "ActivityDocument" (
  "activityId" TEXT PRIMARY KEY REFERENCES "Activity"("id") ON DELETE CASCADE,
  "fileName"   TEXT NOT NULL,
  "mimeType"   TEXT NOT NULL CHECK ("mimeType" IN (
                 'application/pdf',
                 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  "sizeBytes"  INTEGER NOT NULL,
  "pagesJson"  TEXT,
  "data"       BYTEA NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
