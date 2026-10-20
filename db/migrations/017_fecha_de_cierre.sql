ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "endDate" TEXT
  CHECK ("endDate" IS NULL OR "endDate" ~ '^\d{4}-\d{2}-\d{2}$');
