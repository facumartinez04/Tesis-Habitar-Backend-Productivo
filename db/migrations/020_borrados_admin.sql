-- Migración 020: historial de borrados del administrador de la plataforma. Cada borrado de una actividad, un aula
-- o un alumno de una institución queda registrado con quién lo hizo, qué se borró y cuánto arrastró.
CREATE TABLE IF NOT EXISTS "AdminDeletion" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "institutionId" TEXT NOT NULL,
  "kind"          TEXT NOT NULL CHECK ("kind" IN ('ACTIVIDAD', 'AULA', 'ALUMNO')),
  "targetId"      TEXT NOT NULL,
  "targetName"    TEXT NOT NULL,
  -- Qué arrastró el borrado (respuestas, alumnos, actividades…), para poder explicarlo después.
  "detailsJson"   TEXT NOT NULL DEFAULT '{}',
  "performedBy"   TEXT NOT NULL,
  "performedById" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AdminDeletion_institution_idx" ON "AdminDeletion" ("institutionId", "createdAt" DESC);
