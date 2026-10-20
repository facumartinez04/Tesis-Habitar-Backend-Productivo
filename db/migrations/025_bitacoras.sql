CREATE TABLE IF NOT EXISTS "ErrorLog" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source"        TEXT NOT NULL DEFAULT 'API' CHECK ("source" IN ('API', 'PROCESO')),
  "institutionId" TEXT,
  "userId"        TEXT,
  "userEmail"     TEXT,
  "role"          TEXT,
  "method"        TEXT,
  "path"          TEXT,
  "status"        INTEGER NOT NULL DEFAULT 500,
  "message"       TEXT NOT NULL,
  "stack"         TEXT
);
CREATE INDEX IF NOT EXISTS "ErrorLog_createdAt_idx" ON "ErrorLog" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ErrorLog_institution_idx" ON "ErrorLog" ("institutionId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "EventLog" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "institutionId" TEXT,
  "userId"        TEXT,
  "userName"      TEXT,
  "userEmail"     TEXT,
  "role"          TEXT,
  "impersonated"  BOOLEAN NOT NULL DEFAULT false,
  "category"      TEXT NOT NULL CHECK ("category" IN ('ACCESO', 'SEGURIDAD', 'USUARIOS', 'CONFIGURACION', 'ACTIVIDADES', 'DATOS', 'COMERCIAL')),
  "type"          TEXT NOT NULL,
  "entityId"      TEXT,
  "description"   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "EventLog_createdAt_idx" ON "EventLog" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "EventLog_institution_idx" ON "EventLog" ("institutionId", "createdAt" DESC);

ALTER TABLE "AuditLogEntry" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
CREATE INDEX IF NOT EXISTS "AuditLogEntry_institution_idx" ON "AuditLogEntry" ("institutionId", "date" DESC);

UPDATE "AuditLogEntry" ale
   SET "institutionId" = c."institutionId"
  FROM "Student" s JOIN "Course" c ON c."id" = s."courseId"
 WHERE ale."institutionId" IS NULL AND s."id" = ale."studentId";

UPDATE "AuditLogEntry" ale
   SET "institutionId" = ca."institutionId"
  FROM "ConsentAcceptance" ca
 WHERE ale."institutionId" IS NULL
   AND ale."operation" = 'CONSENTIMIENTO'
   AND ca."acceptedBy" = ale."performedBy"
   AND ABS(EXTRACT(EPOCH FROM (ca."acceptedAt" - ale."date"))) < 120;

UPDATE "AuditLogEntry" ale
   SET "institutionId" = u."institutionId"
  FROM "User" u
 WHERE ale."institutionId" IS NULL AND u."id" = ale."performedById" AND u."role" <> 'ADMIN';
