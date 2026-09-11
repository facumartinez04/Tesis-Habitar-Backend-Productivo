-- Migración 010: Finanzas de Plataforma, Finanzas Institucionales y Mercado Pago

-- 1. Gastos de la Plataforma (Negocio Habitar)
CREATE TABLE IF NOT EXISTS "PlatformExpense" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'INFRAESTRUCTURA', -- 'INFRAESTRUCTURA', 'IA_SERVICIOS', 'SERVICIOS_CORREO', 'MARKETING', 'LEGAL_CONTABLE', 'SALARIOS', 'OTROS'
    "title" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "amountArs" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PAGADO', -- 'PAGADO', 'PENDIENTE', 'PROGRAMADO'
    "supplier" TEXT DEFAULT '',
    "receiptUrl" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformExpense_pkey" PRIMARY KEY ("id")
);

-- 2. Transacciones y Cobros (Suscripciones a Plataforma y Cuotas Escolares)
CREATE TABLE IF NOT EXISTS "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT,
    "subscriptionId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'SUBSCRIPCION_PLATAFORMA', -- 'SUBSCRIPCION_PLATAFORMA', 'CUOTA_INSTITUCIONAL', 'MATRICULA', 'OTRO'
    "description" TEXT NOT NULL,
    "amountArs" INTEGER NOT NULL,
    "payerEmail" TEXT DEFAULT '',
    "payerName" TEXT DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO'
    "paymentMethod" TEXT NOT NULL DEFAULT 'MERCADOPAGO', -- 'MERCADOPAGO', 'TRANSFERENCIA', 'EFECTIVO', 'DEBITO'
    "externalReference" TEXT DEFAULT '',
    "mpPaymentId" TEXT DEFAULT '',
    "mpPreferenceId" TEXT DEFAULT '',
    "mpInitPoint" TEXT DEFAULT '',
    "metadata" JSONB DEFAULT '{}'::jsonb,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- 3. Gastos de cada Colegio (Finanzas Institucionales)
CREATE TABLE IF NOT EXISTS "InstitutionExpense" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'MANTENIMIENTO', -- 'INFRAESTRUCTURA', 'MATERIAL_DIDACTICO', 'SERVICIOS', 'PLATAFORMAS_SOFTWARE', 'MANTENIMIENTO', 'EVENTOS', 'OTROS'
    "title" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "amountArs" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PAGADO', -- 'PAGADO', 'PENDIENTE'
    "supplier" TEXT DEFAULT '',
    "invoiceNumber" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionExpense_pkey" PRIMARY KEY ("id")
);

-- 4. Cuotas y Aranceles Escolares (Cobranzas de cada Colegio)
CREATE TABLE IF NOT EXISTS "InstitutionFee" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseId" TEXT,
    "studentId" TEXT,
    "title" TEXT NOT NULL,
    "period" TEXT NOT NULL, -- ej. "2026-03"
    "amountArs" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'PAGADO', 'VENCIDO'
    "tutorEmail" TEXT DEFAULT '',
    "tutorName" TEXT DEFAULT '',
    "mpPreferenceId" TEXT DEFAULT '',
    "mpInitPoint" TEXT DEFAULT '',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionFee_pkey" PRIMARY KEY ("id")
);

-- 5. Configuración de Finanzas y Credenciales de Mercado Pago
CREATE TABLE IF NOT EXISTS "FinanceConfig" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT, -- NULL para plataforma global, o ID para colegio específico
    "mpAccessToken" TEXT DEFAULT '',
    "mpPublicKey" TEXT DEFAULT '',
    "mpWebhookSecret" TEXT DEFAULT '',
    "mpIsSandbox" BOOLEAN NOT NULL DEFAULT true,
    "autoInvoicing" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceConfig_pkey" PRIMARY KEY ("id")
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS "PaymentTransaction_institutionId_idx" ON "PaymentTransaction"("institutionId");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");
CREATE INDEX IF NOT EXISTS "InstitutionExpense_institutionId_idx" ON "InstitutionExpense"("institutionId");
CREATE INDEX IF NOT EXISTS "InstitutionFee_institutionId_idx" ON "InstitutionFee"("institutionId");
CREATE INDEX IF NOT EXISTS "InstitutionFee_status_idx" ON "InstitutionFee"("status");
CREATE INDEX IF NOT EXISTS "FinanceConfig_institutionId_idx" ON "FinanceConfig"("institutionId");

-- Datos iniciales de demostración para gastos de plataforma
INSERT INTO "PlatformExpense" ("id", "category", "title", "description", "amountArs", "date", "status", "supplier")
VALUES
    ('exp_plat_01', 'INFRAESTRUCTURA', 'Servidor de Base de Datos Cloud (PostgreSQL)', 'Instancia de alta disponibilidad y réplicas', 85000, CURRENT_TIMESTAMP - INTERVAL '12 days', 'PAGADO', 'Neon Tech'),
    ('exp_plat_02', 'IA_SERVICIOS', 'Consumo de API DeepSeek & OpenAI', 'Generación de ítems de comprensión lectora para colegios', 145000, CURRENT_TIMESTAMP - INTERVAL '8 days', 'PAGADO', 'DeepSeek AI / OpenAI'),
    ('exp_plat_03', 'SERVICIOS_CORREO', 'Envíos de Correos Transaccionales e Invitaciones', 'Servicio de entrega garantizada de emails institucionales', 28000, CURRENT_TIMESTAMP - INTERVAL '5 days', 'PAGADO', 'Resend Inc.'),
    ('exp_plat_04', 'INFRAESTRUCTURA', 'Hosting Edge & CDN SSL', 'Distribución de assets PWA y aplicación web', 35000, CURRENT_TIMESTAMP - INTERVAL '2 days', 'PAGADO', 'Vercel / Cloudflare')
ON CONFLICT ("id") DO NOTHING;

-- Datos iniciales de demostración para transacciones de pago de plataforma
INSERT INTO "PaymentTransaction" ("id", "type", "description", "amountArs", "payerEmail", "payerName", "status", "paymentMethod", "paidAt")
VALUES
    ('tx_plat_01', 'SUBSCRIPCION_PLATAFORMA', 'Plan Estándar Anual — Escuela San Martín', 1200000, 'direccion@sanmartin.edu.ar', 'Escuela San Martín', 'APROBADO', 'MERCADOPAGO', CURRENT_TIMESTAMP - INTERVAL '15 days'),
    ('tx_plat_02', 'SUBSCRIPCION_PLATAFORMA', 'Plan Premium Anual — Instituto Belgrano', 2200000, 'coordinacion@belgrano.edu.ar', 'Instituto Belgrano', 'APROBADO', 'MERCADOPAGO', CURRENT_TIMESTAMP - INTERVAL '7 days'),
    ('tx_plat_03', 'SUBSCRIPCION_PLATAFORMA', 'Plan Estándar Mensual — Colegio Sarmiento', 120000, 'admin@sarmiento.edu.ar', 'Colegio Sarmiento', 'APROBADO', 'TRANSFERENCIA', CURRENT_TIMESTAMP - INTERVAL '2 days')
ON CONFLICT ("id") DO NOTHING;
