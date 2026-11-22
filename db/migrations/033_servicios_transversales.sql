-- Separa la base de servicios de la de negocio, como en la arquitectura de capas de servicios:
-- usuarios, roles y permisos, sesiones y bitácoras pasan al esquema "service".
-- Las consultas no cambian: la conexión usa search_path = public, service (config/db.ts),
-- y las claves foráneas, índices y secuencias se mueven con cada tabla.
CREATE SCHEMA IF NOT EXISTS service;

ALTER TABLE IF EXISTS public."User" SET SCHEMA service;
ALTER TABLE IF EXISTS public."RoleDefinition" SET SCHEMA service;
ALTER TABLE IF EXISTS public."RolePermission" SET SCHEMA service;
ALTER TABLE IF EXISTS public."RefreshToken" SET SCHEMA service;
ALTER TABLE IF EXISTS public."RevokedToken" SET SCHEMA service;
ALTER TABLE IF EXISTS public."EventLog" SET SCHEMA service;
ALTER TABLE IF EXISTS public."ErrorLog" SET SCHEMA service;
ALTER TABLE IF EXISTS public."AuditLogEntry" SET SCHEMA service;

-- Para las herramientas que se conectan sin pasar por la API (psql, respaldos, paneles):
-- si el usuario tiene permiso, la base queda con el mismo search_path por defecto.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET search_path TO public, service', current_database());
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Sin permiso para cambiar el search_path por defecto de la base; la API lo fija en cada conexión.';
END
$$;
