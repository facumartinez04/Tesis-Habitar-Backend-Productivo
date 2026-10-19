import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: requireEnv('JWT_SECRET'),
  databaseUrl: requireEnv('DATABASE_URL'),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:4321',
  /** Orígenes que pueden llamar a la API. Por defecto, sólo el frontend. */
  corsOrigins: (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? 'http://localhost:4321')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  /**
   * Correos con acceso de administrador de la plataforma. Sin valor por defecto:
   * un acceso privilegiado nunca puede quedar habilitado por omisión.
   */
  superAdminEmails: (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  /** Verificar el certificado TLS de la base. Recomendado; ver db.ts. */
  databaseSslStrict: process.env.DATABASE_SSL_STRICT === 'true',
  mercadoPagoWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? '',
  azureSpeech: {
    key: process.env.AZURE_SPEECH_KEY ?? '',
    region: process.env.AZURE_SPEECH_REGION ?? '',
    defaultVoice: process.env.AZURE_SPEECH_VOICE ?? 'es-AR-ElenaNeural',
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    apiUrl: process.env.DEEPSEEK_API_URL ?? 'https://api.deepseek.com/chat/completions',
    model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    apiUrl: process.env.OPENAI_API_URL ?? 'https://api.openai.com/v1/chat/completions',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY ?? '',
    fromEmail: process.env.RESEND_FROM_EMAIL ?? 'Habitar <onboarding@resend.dev>',
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI ?? '',
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID ?? '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
      tenantId: process.env.MICROSOFT_TENANT_ID ?? 'common',
      redirectUri: process.env.MICROSOFT_REDIRECT_URI ?? '',
    },
  },
};
