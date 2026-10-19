-- Migración 021: documento original de la actividad. El alumno lee el PDF o el Word tal como lo subió el docente
-- (con su formato e imágenes); el texto extraído se sigue usando para la IA. Se borra al cerrar la actividad,
-- igual que el texto (§8.5).
CREATE TABLE IF NOT EXISTS "ActivityDocument" (
  "activityId" TEXT PRIMARY KEY REFERENCES "Activity"("id") ON DELETE CASCADE,
  "fileName"   TEXT NOT NULL,
  "mimeType"   TEXT NOT NULL CHECK ("mimeType" IN (
                 'application/pdf',
                 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  "sizeBytes"  INTEGER NOT NULL,
  -- Páginas del PDF que eligió el docente (JSON, por ejemplo [1,3,4]); NULL = todas.
  "pagesJson"  TEXT,
  "data"       BYTEA NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
