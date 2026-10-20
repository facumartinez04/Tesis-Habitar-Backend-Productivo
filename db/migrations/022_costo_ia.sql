ALTER TABLE "AiUsageEvent" ADD COLUMN IF NOT EXISTS "model" TEXT;
ALTER TABLE "AiUsageEvent" ADD COLUMN IF NOT EXISTS "promptTokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiUsageEvent" ADD COLUMN IF NOT EXISTS "completionTokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AiUsageEvent" ADD COLUMN IF NOT EXISTS "costUsd" NUMERIC(12, 6) NOT NULL DEFAULT 0;
ALTER TABLE "AiUsageEvent" ADD COLUMN IF NOT EXISTS "keySource" TEXT NOT NULL DEFAULT 'PLATAFORMA'
  CHECK ("keySource" IN ('PLATAFORMA', 'PROPIA'));
CREATE INDEX IF NOT EXISTS "AiUsageEvent_institution_created_idx" ON "AiUsageEvent" ("institutionId", "createdAt");

ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "aiMonthlyBudgetUsd" NUMERIC(10, 2)
  CHECK ("aiMonthlyBudgetUsd" IS NULL OR "aiMonthlyBudgetUsd" >= 0);

CREATE TABLE IF NOT EXISTS "AiPrice" (
  "provider"        TEXT NOT NULL,
  "model"           TEXT NOT NULL,
  "inputPerMTokUsd"  NUMERIC(10, 4) NOT NULL CHECK ("inputPerMTokUsd" >= 0),
  "outputPerMTokUsd" NUMERIC(10, 4) NOT NULL CHECK ("outputPerMTokUsd" >= 0),
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("provider", "model")
);
INSERT INTO "AiPrice" ("provider", "model", "inputPerMTokUsd", "outputPerMTokUsd") VALUES
  ('DEEPSEEK', 'deepseek-chat', 0.28, 0.42),
  ('OPENAI', 'gpt-4o-mini', 0.15, 0.60)
ON CONFLICT ("provider", "model") DO NOTHING;
