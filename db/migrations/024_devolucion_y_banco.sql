-- Migración 024: devolución al alumno y banco de actividades de la institución.

-- Al cerrarse la actividad, el alumno puede ver sus respuestas corregidas (el docente lo puede apagar).
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "showFeedback" BOOLEAN NOT NULL DEFAULT true;

-- Banco de actividades: el docente guarda texto, preguntas y documento para que cualquier docente de la institución
-- los reutilice. Es una copia aparte: no se borra al cerrar la actividad de la que salió.
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
