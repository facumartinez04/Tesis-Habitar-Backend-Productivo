import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { LoginIdentity } from './auth.service';
import type { MicrosoftIdentity } from './microsoft-identity';

export const PENDING_LOGIN_DAYS = 7;
const AUDIENCE = 'habitar-ingreso-pendiente';

function secret(): string {
  return `${env.jwtSecret}:ingreso-pendiente`;
}

interface PendingPayload {
  provider: LoginIdentity['provider'];
  email: string;
  name: string | null;
  microsoft: MicrosoftIdentity | null;
}

export function signPendingLogin(identity: LoginIdentity): string {
  const payload: PendingPayload = {
    provider: identity.provider,
    email: identity.email,
    name: identity.name,
    microsoft: identity.microsoft,
  };
  return jwt.sign(payload, secret(), { audience: AUDIENCE, expiresIn: `${PENDING_LOGIN_DAYS}d` });
}

function isMicrosoftIdentity(value: unknown): value is MicrosoftIdentity {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.email === 'string' && typeof v.tenantId === 'string' && typeof v.personal === 'boolean' && typeof v.domainVerified === 'boolean';
}

export function verifyPendingLogin(token: string | undefined): LoginIdentity | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, secret(), { audience: AUDIENCE }) as Partial<PendingPayload>;
    if (p.provider !== 'GOOGLE' && p.provider !== 'MICROSOFT') return null;
    if (typeof p.email !== 'string' || !p.email) return null;
    const microsoft = p.provider === 'MICROSOFT' ? p.microsoft : null;
    if (p.provider === 'MICROSOFT' && !isMicrosoftIdentity(microsoft)) return null;
    return {
      provider: p.provider,
      email: p.email,
      name: typeof p.name === 'string' ? p.name : null,
      microsoft: microsoft ?? null,
    };
  } catch {
    return null;
  }
}
