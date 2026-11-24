CREATE SCHEMA IF NOT EXISTS service;

ALTER TABLE IF EXISTS public."User" SET SCHEMA service;
ALTER TABLE IF EXISTS public."RoleDefinition" SET SCHEMA service;
ALTER TABLE IF EXISTS public."RolePermission" SET SCHEMA service;
ALTER TABLE IF EXISTS public."RefreshToken" SET SCHEMA service;
ALTER TABLE IF EXISTS public."RevokedToken" SET SCHEMA service;
ALTER TABLE IF EXISTS public."EventLog" SET SCHEMA service;
ALTER TABLE IF EXISTS public."ErrorLog" SET SCHEMA service;
ALTER TABLE IF EXISTS public."AuditLogEntry" SET SCHEMA service;

DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET search_path TO public, service', current_database());
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Sin permiso para cambiar el search_path por defecto de la base; la API lo fija en cada conexión.';
END
$$;
