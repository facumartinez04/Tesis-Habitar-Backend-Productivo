import type * as ClientModule from 'openid-client';
import { env } from '../config/env';
import type { OAuthProviderId } from '../domain/enums';

// openid-client v6 se publica como ESM puro (sin build CommonJS). El resto del
// backend compila a CommonJS, así que un `import` estático (o incluso un
// `import()` dinámico normal) termina bajado por tsc a un `require()` que
// Node rechaza en runtime (ERR_REQUIRE_ESM) — solo se nota corriendo el JS
// compilado (`node dist/...`), no con `tsx` en desarrollo, que sí interopera.
// El truco estándar para forzar un import() nativo (que tsc no puede
// reescribir porque no lo reconoce como sintaxis de módulo) es pasarlo por
// un `Function` construido en runtime.
const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<typeof ClientModule>;

let clientModulePromise: Promise<typeof ClientModule> | undefined;
function loadClient(): Promise<typeof ClientModule> {
  if (!clientModulePromise) clientModulePromise = dynamicImport('openid-client');
  return clientModulePromise;
}

let googleConfig: Promise<ClientModule.Configuration> | undefined;
let microsoftConfig: Promise<ClientModule.Configuration> | undefined;

/** Descubre el issuer de Google y arma la Configuration OIDC (lazy + cache). */
export function getGoogleConfig(): Promise<ClientModule.Configuration> {
  if (!env.oauth.google.clientId || !env.oauth.google.clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET no están configurados');
  }
  if (!googleConfig) {
    googleConfig = loadClient().then((client) =>
      client.discovery(new URL('https://accounts.google.com'), env.oauth.google.clientId, env.oauth.google.clientSecret),
    );
  }
  return googleConfig;
}

/** Descubre el issuer de Microsoft (Azure AD v2, multi-tenant por defecto) y arma la Configuration OIDC. */
export function getMicrosoftConfig(): Promise<ClientModule.Configuration> {
  if (!env.oauth.microsoft.clientId || !env.oauth.microsoft.clientSecret) {
    throw new Error('MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET no están configurados');
  }
  if (!microsoftConfig) {
    const tenant = env.oauth.microsoft.tenantId || 'common';
    microsoftConfig = loadClient().then((client) =>
      client.discovery(
        new URL(`https://login.microsoftonline.com/${tenant}/v2.0`),
        env.oauth.microsoft.clientId,
        env.oauth.microsoft.clientSecret,
      ),
    );
  }
  return microsoftConfig;
}

export function getProviderConfig(provider: OAuthProviderId): Promise<ClientModule.Configuration> {
  return provider === 'GOOGLE' ? getGoogleConfig() : getMicrosoftConfig();
}

export function getRedirectUri(provider: OAuthProviderId): string {
  const uri = provider === 'GOOGLE' ? env.oauth.google.redirectUri : env.oauth.microsoft.redirectUri;
  if (!uri) throw new Error(`Falta configurar el redirect URI de ${provider}`);
  return uri;
}

export { loadClient };
