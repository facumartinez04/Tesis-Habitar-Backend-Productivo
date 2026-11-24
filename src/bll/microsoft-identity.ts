import { ForbiddenError, UnauthorizedError } from '../utils/http-error';

export const MICROSOFT_PERSONAL_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isTenantId(value: string): boolean {
  return GUID.test(value);
}

export interface MicrosoftIdentity {
  email: string;
  tenantId: string;
  personal: boolean;
  domainVerified: boolean;
}

function isTrue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

export function microsoftIdentityFromClaims(claims: Record<string, unknown> | undefined): MicrosoftIdentity {
  const tenantId = typeof claims?.tid === 'string' ? claims.tid.toLowerCase() : '';
  if (!isTenantId(tenantId)) throw new UnauthorizedError('La cuenta de Microsoft no informa su organización');
  const personal = tenantId === MICROSOFT_PERSONAL_TENANT;
  const upn = typeof claims?.preferred_username === 'string' ? claims.preferred_username : '';
  const guest = !personal && (upn.includes('#EXT#') || claims?.acct === 1 || claims?.acct === '1');
  if (guest) throw new ForbiddenError('Las cuentas invitadas de Microsoft no pueden ingresar a Habitar.');
  const raw = typeof claims?.email === 'string' && claims.email ? claims.email : upn;
  const email = raw.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new UnauthorizedError('La cuenta no expone un email verificado');
  return { email, tenantId, personal, domainVerified: !personal && isTrue(claims?.xms_edov) };
}

export function assertMicrosoftEmailTrusted(identity: MicrosoftIdentity, institution: { microsoftTenantId: string | null } | null): void {
  if (identity.personal || identity.domainVerified) return;
  const linked = institution?.microsoftTenantId?.toLowerCase() ?? null;
  if (linked && linked === identity.tenantId) return;
  throw new ForbiddenError('Tu cuenta de Microsoft no pertenece a la organización de la institución registrada en Habitar.');
}
