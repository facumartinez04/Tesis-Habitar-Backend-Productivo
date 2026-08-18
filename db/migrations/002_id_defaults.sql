-- Prisma generaba los ids (cuid()) del lado del cliente; sin Prisma, los generamos
-- en la base con gen_random_uuid(). Los repositories ya no mandan "id" en los INSERT.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "Institution" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "InstitutionLevel" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Course" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Student" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Activity" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Question" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Response" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Answer" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "StudentResult" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "PerformanceAlert" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "AuditLogEntry" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "ConsentDocument" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "ConsentAcceptance" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Plan" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Subscription" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "OAuthIntegration" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "MonitoringComponent" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Incident" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Feedback" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "RetentionPolicy" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "AiUsageEvent" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
