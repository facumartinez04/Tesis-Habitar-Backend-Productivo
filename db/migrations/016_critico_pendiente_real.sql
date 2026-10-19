-- Migración 016: «pendiente de revisión» sólo cuando hay una respuesta escrita sin revisar.
-- La 014 agregó "criticoReviewed" con valor por defecto false, y los resultados anteriores
-- quedaron como pendientes aunque no tuvieran ninguna respuesta abierta que revisar.

ALTER TABLE "StudentResult" ALTER COLUMN "criticoReviewed" SET DEFAULT true;

UPDATE "StudentResult" sr
   SET "criticoReviewed" = NOT EXISTS (
     SELECT 1
       FROM "Answer" a
       JOIN "Question" q ON q."id" = a."questionId"
      WHERE a."responseId" = sr."responseId"
        AND q."axis" = 'CRITICO'
        AND q."correctOption" IS NULL
        AND a."textAnswer" IS NOT NULL
        AND a."teacherScore" IS NULL
   );
