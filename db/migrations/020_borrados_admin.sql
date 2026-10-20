CREATE TABLE IF NOT EXISTS "AdminDeletion" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "institutionId" TEXT NOT NULL,
  "kind"          TEXT NOT NULL CHECK ("kind" IN ('ACTIVIDAD', 'AULA', 'ALUMNO')),
  "targetId"      TEXT NOT NULL,
  "targetName"    TEXT NOT NULL,
  "detailsJson"   TEXT NOT NULL DEFAULT '{}',
  "performedBy"   TEXT NOT NULL,
  "performedById" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AdminDeletion_institution_idx" ON "AdminDeletion" ("institutionId", "createdAt" DESC);
