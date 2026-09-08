-- Migration 005: Sistema de Roles Dinámicos y Matriz de Permisos por Módulo (RBAC)

CREATE TABLE IF NOT EXISTS "RoleDefinition" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "RolePermission" (
  "id" SERIAL PRIMARY KEY,
  "roleId" TEXT NOT NULL REFERENCES "RoleDefinition"("id") ON DELETE CASCADE,
  "module" TEXT NOT NULL,
  "canRead" BOOLEAN NOT NULL DEFAULT false,
  "canCreate" BOOLEAN NOT NULL DEFAULT false,
  "canUpdate" BOOLEAN NOT NULL DEFAULT false,
  "canDelete" BOOLEAN NOT NULL DEFAULT false,
  "canExport" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "uq_role_permission_module" UNIQUE ("roleId", "module")
);

CREATE INDEX IF NOT EXISTS "idx_role_permission_role_id" ON "RolePermission"("roleId");

-- Seed de Roles Iniciales
INSERT INTO "RoleDefinition" ("id", "name", "description", "isSystem")
VALUES
  ('admin', 'Administrador Global', 'Control absoluto de la plataforma, infraestructura y multi-tenant.', true),
  ('coordinador', 'Coordinador Pedagógico', 'Gestión institucional, docentes, alertas y cumplimiento normativo.', true),
  ('docente', 'Docente Titular', 'Creación de actividades con IA, seguimiento de cursos y lectura.', true),
  ('director', 'Director Institucional', 'Supervisión ejecutiva, analíticas de comprensión y reportes.', false),
  ('auditor', 'Auditor de Privacidad (DPO)', 'Control de registros ARCO, políticas de retención y bitácora de auditoría.', false)
ON CONFLICT ("id") DO UPDATE
  SET "name" = EXCLUDED."name",
      "description" = EXCLUDED."description",
      "isSystem" = EXCLUDED."isSystem";

-- Módulos del sistema
-- instituciones, configuracion, usuarios, cursos, actividades, alumnos, resultados, alertas, cumplimiento, suscripciones, monitoreo, jira, roles

-- Permisos ADMIN (todo en true)
INSERT INTO "RolePermission" ("roleId", "module", "canRead", "canCreate", "canUpdate", "canDelete", "canExport")
SELECT 'admin', m, true, true, true, true, true
FROM unnest(ARRAY[
  'instituciones', 'configuracion', 'usuarios', 'cursos', 'actividades',
  'alumnos', 'resultados', 'alertas', 'cumplimiento', 'suscripciones',
  'monitoreo', 'jira', 'roles'
]) AS m
ON CONFLICT ("roleId", "module") DO NOTHING;

-- Permisos COORDINADOR
INSERT INTO "RolePermission" ("roleId", "module", "canRead", "canCreate", "canUpdate", "canDelete", "canExport")
VALUES
  ('coordinador', 'instituciones', true, false, true, false, true),
  ('coordinador', 'configuracion', true, true, true, false, true),
  ('coordinador', 'usuarios', true, true, true, true, true),
  ('coordinador', 'cursos', true, true, true, false, true),
  ('coordinador', 'actividades', true, false, true, false, true),
  ('coordinador', 'alumnos', true, true, true, true, true),
  ('coordinador', 'resultados', true, false, false, false, true),
  ('coordinador', 'alertas', true, true, true, false, true),
  ('coordinador', 'cumplimiento', true, true, true, true, true),
  ('coordinador', 'suscripciones', true, false, false, false, false),
  ('coordinador', 'monitoreo', true, false, false, false, false),
  ('coordinador', 'jira', true, true, true, false, false),
  ('coordinador', 'roles', true, false, false, false, false)
ON CONFLICT ("roleId", "module") DO NOTHING;

-- Permisos DOCENTE
INSERT INTO "RolePermission" ("roleId", "module", "canRead", "canCreate", "canUpdate", "canDelete", "canExport")
VALUES
  ('docente', 'instituciones', false, false, false, false, false),
  ('docente', 'configuracion', false, false, false, false, false),
  ('docente', 'usuarios', false, false, false, false, false),
  ('docente', 'cursos', true, false, false, false, true),
  ('docente', 'actividades', true, true, true, true, true),
  ('docente', 'alumnos', true, false, false, false, true),
  ('docente', 'resultados', true, false, false, false, true),
  ('docente', 'alertas', true, false, false, false, false),
  ('docente', 'cumplimiento', false, false, false, false, false),
  ('docente', 'suscripciones', false, false, false, false, false),
  ('docente', 'monitoreo', false, false, false, false, false),
  ('docente', 'jira', false, false, false, false, false),
  ('docente', 'roles', false, false, false, false, false)
ON CONFLICT ("roleId", "module") DO NOTHING;

-- Permisos DIRECTOR
INSERT INTO "RolePermission" ("roleId", "module", "canRead", "canCreate", "canUpdate", "canDelete", "canExport")
VALUES
  ('director', 'instituciones', true, false, false, false, true),
  ('director', 'configuracion', true, false, false, false, true),
  ('director', 'usuarios', true, false, false, false, true),
  ('director', 'cursos', true, false, false, false, true),
  ('director', 'actividades', true, false, false, false, true),
  ('director', 'alumnos', true, false, false, false, true),
  ('director', 'resultados', true, false, false, false, true),
  ('director', 'alertas', true, false, true, false, true),
  ('director', 'cumplimiento', true, false, false, false, true),
  ('director', 'suscripciones', true, false, false, false, true),
  ('director', 'monitoreo', true, false, false, false, false),
  ('director', 'jira', true, false, false, false, false),
  ('director', 'roles', false, false, false, false, false)
ON CONFLICT ("roleId", "module") DO NOTHING;

-- Permisos AUDITOR
INSERT INTO "RolePermission" ("roleId", "module", "canRead", "canCreate", "canUpdate", "canDelete", "canExport")
VALUES
  ('auditor', 'instituciones', true, false, false, false, false),
  ('auditor', 'configuracion', true, false, false, false, false),
  ('auditor', 'usuarios', true, false, false, false, false),
  ('auditor', 'cursos', false, false, false, false, false),
  ('auditor', 'actividades', false, false, false, false, false),
  ('auditor', 'alumnos', true, false, false, false, true),
  ('auditor', 'resultados', true, false, false, false, true),
  ('auditor', 'alertas', true, false, false, false, false),
  ('auditor', 'cumplimiento', true, true, true, true, true),
  ('auditor', 'suscripciones', false, false, false, false, false),
  ('auditor', 'monitoreo', true, false, false, false, true),
  ('auditor', 'jira', false, false, false, false, false),
  ('auditor', 'roles', false, false, false, false, false)
ON CONFLICT ("roleId", "module") DO NOTHING;
