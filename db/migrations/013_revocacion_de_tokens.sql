-- Migración 013: revocación de tokens al cerrar sesión.
-- Antes, cerrar sesión sólo borraba el token del navegador y el token seguía
-- siendo válido hasta vencer. Ahora cada token tiene un identificador (jti) y el
-- logout lo registra acá; el middleware de autenticación rechaza los revocados.

CREATE TABLE IF NOT EXISTS "RevokedToken" (
  "jti"       TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "RevokedToken_expiresAt_idx" ON "RevokedToken" ("expiresAt");
