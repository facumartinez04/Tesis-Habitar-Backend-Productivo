-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DOCENTE', 'COORDINADOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('PRIMARIO', 'SECUNDARIO');

-- CreateEnum
CREATE TYPE "InstitutionStatus" AS ENUM ('ACTIVO', 'PILOTO_NO_CONFIRMADO');

-- CreateEnum
CREATE TYPE "ComprehensionAxis" AS ENUM ('LITERAL', 'INFERENCIAL', 'CRITICO');

-- CreateEnum
CREATE TYPE "AttemptPolicy" AS ENUM ('UNICO', 'REINTENTOS');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('BORRADOR', 'PROGRAMADA', 'PUBLICADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICA', 'ADVERTENCIA', 'RESUELTA');

-- CreateEnum
CREATE TYPE "AuditOperation" AS ENUM ('EXPORTACION', 'ELIMINACION', 'CONSENTIMIENTO');

-- CreateEnum
CREATE TYPE "SubscriptionManagementStatus" AS ENUM ('EN_NEGOCIACION', 'CONFIRMADO');

-- CreateEnum
CREATE TYPE "ComponentHealth" AS ENUM ('OPERATIVO', 'DEGRADADO', 'CAIDO');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('RESUELTO', 'PLANIFICADO', 'EN_CURSO');

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "InstitutionStatus" NOT NULL DEFAULT 'ACTIVO',
    "coordinatorEmail" TEXT NOT NULL,
    "enabledAxesCsv" TEXT NOT NULL DEFAULT 'LITERAL,INFERENCIAL,CRITICO',
    "aiMonthlyQuota" INTEGER NOT NULL DEFAULT 200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionLevel" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "level" "EducationLevel" NOT NULL,

    CONSTRAINT "InstitutionLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "institutionId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "educationLevel" TEXT NOT NULL,
    "axis" "ComprehensionAxis" NOT NULL,
    "sourceText" TEXT NOT NULL,
    "availableFrom" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "attemptPolicy" "AttemptPolicy" NOT NULL DEFAULT 'UNICO',
    "status" "ActivityStatus" NOT NULL DEFAULT 'PUBLICADA',
    "qrValidUntil" TEXT NOT NULL DEFAULT '4 hs',
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "axis" "ComprehensionAxis" NOT NULL,
    "prompt" TEXT NOT NULL,
    "expectedAnswer" TEXT NOT NULL,
    "optionsJson" TEXT,
    "correctOption" TEXT,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "studentId" TEXT,
    "studentDisplayName" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOption" TEXT NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentResult" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "literalScore" INTEGER NOT NULL,
    "inferencialScore" INTEGER NOT NULL,
    "criticoScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceAlert" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "axis" "ComprehensionAxis" NOT NULL,
    "currentValue" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "detectedAt" TEXT NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "PerformanceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL,
    "studentId" TEXT,
    "studentName" TEXT NOT NULL,
    "operation" "AuditOperation" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "performedById" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentDocument" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "publishedAt" TEXT NOT NULL,
    "dataController" TEXT NOT NULL,
    "dataProcessor" TEXT NOT NULL,

    CONSTRAINT "ConsentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentAcceptance" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "acceptedBy" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentVersion" TEXT NOT NULL,

    CONSTRAINT "ConsentAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPriceArs" INTEGER NOT NULL,
    "maxUsers" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "monthlyPriceArs" INTEGER NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "managementStatus" "SubscriptionManagementStatus" NOT NULL DEFAULT 'EN_NEGOCIACION',
    "durationMonths" INTEGER NOT NULL DEFAULT 12,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthIntegration" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "clientId" TEXT NOT NULL,
    "currentStepIndex" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "OAuthIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringComponent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "health" "ComponentHealth" NOT NULL DEFAULT 'OPERATIVO',
    "uptimePercent" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MonitoringComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "retentionMonths" INTEGER NOT NULL DEFAULT 24,
    "lastPurgeAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'deepseek',
    "success" BOOLEAN NOT NULL DEFAULT true,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Institution_slug_key" ON "Institution"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionLevel_institutionId_level_key" ON "InstitutionLevel"("institutionId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_institutionId_idx" ON "User"("institutionId");

-- CreateIndex
CREATE INDEX "Course_institutionId_idx" ON "Course"("institutionId");

-- CreateIndex
CREATE INDEX "Course_teacherId_idx" ON "Course"("teacherId");

-- CreateIndex
CREATE INDEX "Student_courseId_idx" ON "Student"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_code_key" ON "Activity"("code");

-- CreateIndex
CREATE INDEX "Activity_courseId_idx" ON "Activity"("courseId");

-- CreateIndex
CREATE INDEX "Question_activityId_idx" ON "Question"("activityId");

-- CreateIndex
CREATE INDEX "Response_activityId_idx" ON "Response"("activityId");

-- CreateIndex
CREATE INDEX "Response_studentId_idx" ON "Response"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_responseId_questionId_key" ON "Answer"("responseId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentResult_responseId_key" ON "StudentResult"("responseId");

-- CreateIndex
CREATE INDEX "StudentResult_studentId_idx" ON "StudentResult"("studentId");

-- CreateIndex
CREATE INDEX "StudentResult_activityId_idx" ON "StudentResult"("activityId");

-- CreateIndex
CREATE INDEX "PerformanceAlert_courseId_idx" ON "PerformanceAlert"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentDocument_version_key" ON "ConsentDocument"("version");

-- CreateIndex
CREATE INDEX "ConsentAcceptance_institutionId_idx" ON "ConsentAcceptance"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_institutionId_key" ON "Subscription"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthIntegration_institutionId_key" ON "OAuthIntegration"("institutionId");

-- CreateIndex
CREATE INDEX "Feedback_studentId_idx" ON "Feedback"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionPolicy_institutionId_key" ON "RetentionPolicy"("institutionId");

-- CreateIndex
CREATE INDEX "AiUsageEvent_institutionId_idx" ON "AiUsageEvent"("institutionId");

-- AddForeignKey
ALTER TABLE "InstitutionLevel" ADD CONSTRAINT "InstitutionLevel_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResult" ADD CONSTRAINT "StudentResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResult" ADD CONSTRAINT "StudentResult_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResult" ADD CONSTRAINT "StudentResult_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceAlert" ADD CONSTRAINT "PerformanceAlert_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentAcceptance" ADD CONSTRAINT "ConsentAcceptance_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthIntegration" ADD CONSTRAINT "OAuthIntegration_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

