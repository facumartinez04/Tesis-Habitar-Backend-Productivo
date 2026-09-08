-- Migración 009: Configuración de Inteligencia Artificial por Institución (DeepSeek / OpenAI / BYOK)

ALTER TABLE "Institution"
ADD COLUMN IF NOT EXISTS "aiProvider" TEXT NOT NULL DEFAULT 'DEEPSEEK',
ADD COLUMN IF NOT EXISTS "aiKeySource" TEXT NOT NULL DEFAULT 'PLATFORM',
ADD COLUMN IF NOT EXISTS "aiCustomApiKey" TEXT,
ADD COLUMN IF NOT EXISTS "aiModel" TEXT;
