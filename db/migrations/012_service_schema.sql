-- Migración 012: Schema "service" para datos operacionales (chat, telemetría)
-- Las tablas de negocio quedan en public; las nuevas tablas operacionales van en service.

CREATE SCHEMA IF NOT EXISTS service;

CREATE TABLE IF NOT EXISTS service."ChatMessage" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "studentId" TEXT,
  "institutionId" TEXT NOT NULL,
  "role" TEXT NOT NULL CHECK ("role" IN ('user', 'tutor')),
  "message" TEXT NOT NULL,
  "activeChunk" TEXT,
  "tokensUsed" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_chat_msg_user" ON service."ChatMessage"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_chat_msg_institution" ON service."ChatMessage"("institutionId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS service."IaGeneration" (
  "id" TEXT PRIMARY KEY,
  "institutionId" TEXT NOT NULL,
  "userId" TEXT,
  "generationType" TEXT NOT NULL,
  "model" TEXT NOT NULL DEFAULT 'deepseek-chat',
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "contextLength" INTEGER,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_ia_gen_institution" ON service."IaGeneration"("institutionId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS service."TelemetryEvent" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "studentId" TEXT,
  "institutionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "chunkId" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_telemetry_user" ON service."TelemetryEvent"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_telemetry_institution" ON service."TelemetryEvent"("institutionId", "createdAt" DESC);
