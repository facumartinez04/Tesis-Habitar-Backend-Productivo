import type * as ClientModule from 'openid-client';
import { env } from '../config/env';
import type { OAuthProviderId } from '../domain/enums';

const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<typeof ClientModule>;

let clientModulePromise: Promise<typeof ClientModule> | undefined;
function loadClient(): Promise<typeof ClientModule> {
  if (!clientModulePromise) clientModulePromise = dynamicImport('openid-client');
  return clientModulePromise;
}

let googleConfig: Promise<ClientModule.Configuration> | undefined;
let microsoftConfig: Promise<ClientModule.Configuration> | undefined;

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
