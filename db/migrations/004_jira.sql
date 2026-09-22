-- Migration 004: Tablas de Jira e integración para IA (Tokens de Acceso)

CREATE TABLE IF NOT EXISTS "JiraIssue" (
  "id" VARCHAR(32) PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "type" VARCHAR(32) NOT NULL DEFAULT 'task',
  "priority" VARCHAR(32) NOT NULL DEFAULT 'medium',
  "status" VARCHAR(32) NOT NULL DEFAULT 'todo',
  "assignee" JSONB NOT NULL DEFAULT '{"id": "usr-1", "name": "Facundo (Admin)", "email": "facumarti06@gmail.com", "initials": "FA", "color": "bg-teal-700"}'::jsonb,
  "tags" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "dueDate" DATE,
  "storyPoints" INT,
  "checklist" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "comments" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_jira_issues_status" ON "JiraIssue"("status");

CREATE TABLE IF NOT EXISTS "JiraToken" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL DEFAULT 'AI Jira Agent',
  "token" TEXT NOT NULL UNIQUE,
  "prefix" TEXT NOT NULL DEFAULT 'hab_jira_',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lastUsedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "idx_jira_tokens_token" ON "JiraToken"("token");
