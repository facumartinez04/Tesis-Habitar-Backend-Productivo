import { ForbiddenError, UnauthorizedError } from '../utils/http-error';

/** Tenant fijo de las cuentas personales de Microsoft (Outlook, Hotmail, Live). */
export const MICROSOFT_PERSONAL_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isTenantId(value: string): boolean {
  return GUID.test(value);
}

export interface MicrosoftIdentity {
  email: string;
  tenantId: string;
  /** Cuenta personal de Microsoft: el correo lo verifica Microsoft, como una cuenta de Gmail con Google. */
  personal: boolean;
  /** Cuenta de una organización cuyo dominio de correo está verificado por esa misma organización (claim xms_edov). */
  domainVerified: boolean;
}

function isTrue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

/**
 * Lee el correo y la organización (tenant) del token de ID de Microsoft.
 * Acepta cuentas personales y de organizaciones; rechaza las cuentas invitadas.
 * En las cuentas de organización el claim `email` es opcional, así que se usa `preferred_username` cuando no viene.
 */
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

/**
 * Decide si se puede confiar en el correo que informa Microsoft para identificar al usuario y su institución.
 * En una organización de Microsoft el administrador puede poner cualquier correo a sus usuarios, así que el correo
 * de una cuenta de organización solo vale si el dominio está verificado por esa organización (xms_edov) o si la
 * cuenta viene de la organización que el administrador de Habitar vinculó a la institución.
 * Las cuentas personales sí valen: Microsoft verifica su correo.
 */
export function assertMicrosoftEmailTrusted(identity: MicrosoftIdentity, institution: { microsoftTenantId: string | null } | null): void {
  if (identity.personal || identity.domainVerified) return;
  const linked = institution?.microsoftTenantId?.toLowerCase() ?? null;
  if (linked && linked === identity.tenantId) return;
  throw new ForbiddenError('Tu cuenta de Microsoft no pertenece a la organización de la institución registrada en Habitar.');
}
