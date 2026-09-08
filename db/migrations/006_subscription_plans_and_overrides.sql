-- Migración 006: Planes de suscripción dinámicos y personalización por negocio

-- 1. Ampliación de la tabla Plan
ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "annualPriceArs" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "maxStudents" INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS "maxCourses" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "storageGb" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "features" JSONB NOT NULL DEFAULT '{"hasAiAnalytics": false, "hasEarlyAlerts": true, "hasArcoCompliance": true, "hasCustomDomain": false, "hasApiAccess": false, "hasSlaSupport": false, "hasExportReports": true, "bullets": []}'::jsonb,
  ADD COLUMN IF NOT EXISTS "badge" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2. Ampliación de la tabla Subscription para personalizaciones por negocio
ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "customMaxUsers" INTEGER,
  ADD COLUMN IF NOT EXISTS "customMaxStudents" INTEGER,
  ADD COLUMN IF NOT EXISTS "customMaxCourses" INTEGER,
  ADD COLUMN IF NOT EXISTS "customStorageGb" INTEGER,
  ADD COLUMN IF NOT EXISTS "customFeatures" JSONB,
  ADD COLUMN IF NOT EXISTS "customNotes" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY';

-- 3. Actualizar o insertar planes base de referencia si faltan
INSERT INTO "Plan" ("id", "name", "description", "monthlyPriceArs", "annualPriceArs", "maxUsers", "maxStudents", "maxCourses", "storageGb", "features", "badge", "isActive")
VALUES
  (
    'piloto',
    'Piloto Gratuito',
    'Plan inicial sin costo para validación institucional durante 60 días.',
    0,
    0,
    15,
    150,
    8,
    5,
    '{"hasAiAnalytics": false, "hasEarlyAlerts": true, "hasArcoCompliance": true, "hasCustomDomain": false, "hasApiAccess": false, "hasSlaSupport": false, "hasExportReports": true, "bullets": ["Hasta 15 docentes", "150 alumnos incluidos", "Alertas tempranas de asistencia", "Cumplimiento ARCO"]}'::jsonb,
    'Piloto',
    true
  ),
  (
    'estandar',
    'Plan Estándar',
    'Ideal para escuelas medianas que buscan digitalizar el seguimiento pedagógico.',
    120000,
    1200000,
    50,
    600,
    25,
    20,
    '{"hasAiAnalytics": false, "hasEarlyAlerts": true, "hasArcoCompliance": true, "hasCustomDomain": false, "hasApiAccess": false, "hasSlaSupport": true, "hasExportReports": true, "bullets": ["Hasta 50 docentes", "600 alumnos incluidos", "Exportación completa a Excel/PDF", "Soporte prioritario por email", "Alertas tempranas avanzadas"]}'::jsonb,
    'Popular',
    true
  ),
  (
    'premium',
    'Premium Institucional',
    'Para colegios de alta exigencia que requieren analítica predictiva de IA y máxima personalización.',
    220000,
    2200000,
    150,
    1800,
    80,
    100,
    '{"hasAiAnalytics": true, "hasEarlyAlerts": true, "hasArcoCompliance": true, "hasCustomDomain": true, "hasApiAccess": true, "hasSlaSupport": true, "hasExportReports": true, "bullets": ["Docentes ilimitados (hasta 150)", "1.800 alumnos incluidos", "Analítica con IA y alertas predictivas", "Dominio personalizado (Marca Blanca)", "Acceso a API y webhooks", "SLA soporte telefónico 24/7"]}'::jsonb,
    'Recomendado',
    true
  )
ON CONFLICT ("id") DO UPDATE SET
  "description" = EXCLUDED."description",
  "annualPriceArs" = EXCLUDED."annualPriceArs",
  "maxStudents" = EXCLUDED."maxStudents",
  "maxCourses" = EXCLUDED."maxCourses",
  "storageGb" = EXCLUDED."storageGb",
  "features" = EXCLUDED."features",
  "badge" = EXCLUDED."badge",
  "isActive" = EXCLUDED."isActive";
