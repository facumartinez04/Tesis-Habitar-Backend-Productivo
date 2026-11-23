-- Inicio de sesión con Microsoft 365: cada institución queda atada a su organización (tenant) de Microsoft Entra.
-- Sin este dato la institución no puede ingresar con Microsoft: el correo que informa Microsoft lo define el
-- administrador de cada tenant, así que el dominio por sí solo no alcanza para saber de qué escuela es la cuenta.
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "microsoftTenantId" TEXT;
