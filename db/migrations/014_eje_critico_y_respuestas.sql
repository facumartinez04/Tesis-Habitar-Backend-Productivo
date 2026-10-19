-- Migración 014: medición real del eje crítico.
-- Las preguntas críticas son abiertas y no tienen opción correcta, así que el
-- cálculo anterior las ignoraba y dejaba el eje en 50 para todos. Ahora se guarda
-- el texto de la respuesta, la IA propone un puntaje con rúbrica (0 a 3) y el
-- docente lo confirma o lo corrige.

ALTER TABLE "Answer" ALTER COLUMN "selectedOption" DROP NOT NULL;
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "textAnswer"   TEXT;
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "aiScore"      INTEGER CHECK ("aiScore" BETWEEN 0 AND 3);
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "aiRationale"  TEXT;
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "teacherScore" INTEGER CHECK ("teacherScore" BETWEEN 0 AND 3);
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "reviewedAt"   TIMESTAMP(3);
ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;

-- Un eje sin preguntas puntuables queda sin dato, en lugar de un valor inventado.
ALTER TABLE "StudentResult" ALTER COLUMN "literalScore"     DROP NOT NULL;
ALTER TABLE "StudentResult" ALTER COLUMN "inferencialScore" DROP NOT NULL;
ALTER TABLE "StudentResult" ALTER COLUMN "criticoScore"     DROP NOT NULL;
-- true cuando todas las respuestas críticas del intento fueron revisadas por el docente.
ALTER TABLE "StudentResult" ADD COLUMN IF NOT EXISTS "criticoReviewed" BOOLEAN NOT NULL DEFAULT false;

-- Los resultados históricos tenían el eje crítico en 50 sin haberlo medido.
-- Se limpian para no mezclar datos inventados con datos reales.
UPDATE "StudentResult" sr
   SET "criticoScore" = NULL
 WHERE sr."criticoScore" = 50
   AND NOT EXISTS (
     SELECT 1 FROM "Question" q
      WHERE q."activityId" = sr."activityId" AND q."axis" = 'CRITICO' AND q."correctOption" IS NOT NULL
   );

-- Dispositivo desde el que se respondió, para validar contra la vinculación del aula.
ALTER TABLE "Response" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;

CREATE INDEX IF NOT EXISTS "Response_activity_student_idx" ON "Response" ("activityId", "studentId");
