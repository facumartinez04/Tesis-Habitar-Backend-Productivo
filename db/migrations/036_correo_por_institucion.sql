-- Una misma persona (el mismo correo) puede estar en más de una institución: cada fila de User es la cuenta de esa
-- persona en esa institución, con su propio rol y estado. El correo pasa a ser único POR INSTITUCIÓN, no en toda la plataforma.
DROP INDEX IF EXISTS service."User_email_key";

DO $$
BEGIN
  -- Si por algún motivo hubiera dos filas del mismo correo (sin importar mayúsculas) en una institución, no se frena el
  -- arranque: se crea un índice común y la aplicación sigue impidiendo repetidos al invitar.
  IF EXISTS (SELECT 1 FROM service."User" GROUP BY lower("email"), "institutionId" HAVING count(*) > 1) THEN
    RAISE NOTICE 'Hay correos repetidos dentro de una institución: se crea un índice no único. Revisá la tabla User.';
    CREATE INDEX IF NOT EXISTS "User_email_institution_idx" ON service."User" (lower("email"), "institutionId");
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "User_email_institution_key" ON service."User" (lower("email"), "institutionId");
  END IF;
END $$;
