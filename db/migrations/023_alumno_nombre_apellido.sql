ALTER TABLE "Institution" ALTER COLUMN "studentIdMode" SET DEFAULT 'NOMBRE';
UPDATE "Institution" SET "studentIdMode" = 'NOMBRE' WHERE "studentIdMode" = 'LISTA';
