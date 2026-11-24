DROP INDEX IF EXISTS service."User_email_key";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM service."User" GROUP BY lower("email"), "institutionId" HAVING count(*) > 1) THEN
    RAISE NOTICE 'Hay correos repetidos dentro de una institución: se crea un índice no único. Revisá la tabla User.';
    CREATE INDEX IF NOT EXISTS "User_email_institution_idx" ON service."User" (lower("email"), "institutionId");
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "User_email_institution_key" ON service."User" (lower("email"), "institutionId");
  END IF;
END $$;
