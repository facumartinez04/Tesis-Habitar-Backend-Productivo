-- Migración 023: el alumno se identifica con nombre y apellido en todas las instituciones (antes, número de lista).
-- Cada institución puede volver a número de lista desde su configuración.
ALTER TABLE "Institution" ALTER COLUMN "studentIdMode" SET DEFAULT 'NOMBRE';
UPDATE "Institution" SET "studentIdMode" = 'NOMBRE' WHERE "studentIdMode" = 'LISTA';
