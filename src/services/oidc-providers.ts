import * as client from 'openid-client';
import { env } from '../config/env';
import type { OAuthProviderId } from '../domain/enums';

let googleConfig: Promise<client.Configuration> | undefined;
let microsoftConfig: Promise<client.Configuration> | undefined;

/** Descubre el issuer de Google y arma la Configuration OIDC (lazy + cache). */
export function getGoogleConfig(): Promise<client.Configuration> {
  if (!env.oauth.google.clientId || !env.oauth.google.clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET no están configurados');
  }
  if (!googleConfig) {
    googleConfig = client.discovery(
      new URL('https://accounts.google.com'),
      env.oauth.google.clientId,
      env.oauth.google.clientSecret,
    );
  }
  return googleConfig;
}

/** Descubre el issuer de Microsoft (Azure AD v2, multi-tenant por defecto) y arma la Configuration OIDC. */
export function getMicrosoftConfig(): Promise<client.Configuration> {
  if (!env.oauth.microsoft.clientId || !env.oauth.microsoft.clientSecret) {
    throw new Error('MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET no están configurados');
  }
  if (!microsoftConfig) {
    const tenant = env.oauth.microsoft.tenantId || 'common';
    microsoftConfig = client.discovery(
      new URL(`https://login.microsoftonline.com/${tenant}/v2.0`),
      env.oauth.microsoft.clientId,
      env.oauth.microsoft.clientSecret,
    );
  }
  return microsoftConfig;
}

export function getProviderConfig(provider: OAuthProviderId): Promise<client.Configuration> {
  return provider === 'GOOGLE' ? getGoogleConfig() : getMicrosoftConfig();
}

export function getRedirectUri(provider: OAuthProviderId): string {
  const uri = provider === 'GOOGLE' ? env.oauth.google.redirectUri : env.oauth.microsoft.redirectUri;
  if (!uri) throw new Error(`Falta configurar el redirect URI de ${provider}`);
  return uri;
}
