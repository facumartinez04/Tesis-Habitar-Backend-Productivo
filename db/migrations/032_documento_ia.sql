-- La IA también ordena el texto de las páginas escaneadas que el OCR no leyó bien.
ALTER TABLE "AiUsageEvent" DROP CONSTRAINT IF EXISTS "AiUsageEvent_kind_check";
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_kind_check" CHECK ("kind" IN ('GENERACION', 'CORRECCION', 'AYUDA', 'DOCUMENTO'));
