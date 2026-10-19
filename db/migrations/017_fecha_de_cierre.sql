-- Migración 017: fecha de cierre propia. La actividad puede abrir un día y cerrar otro (por ejemplo, de las 22:00
-- a las 10:00 del día siguiente, o durante varios días). Sin fecha de cierre, cierra el mismo día que abre.
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "endDate" TEXT
  CHECK ("endDate" IS NULL OR "endDate" ~ '^\d{4}-\d{2}-\d{2}$');
