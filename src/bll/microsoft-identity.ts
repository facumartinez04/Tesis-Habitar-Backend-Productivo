import { ForbiddenError, UnauthorizedError } from '../utils/http-error';

/** Tenant fijo de las cuentas personales de Microsoft (Outlook, Hotmail, Live): no son cuentas institucionales. */
export const MICROSOFT_PERSONAL_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isTenantId(value: string): boolean {
  return GUID.test(value);
}

export interface MicrosoftIdentity {
  email: string;
  tenantId: string;
}

/**
 * Lee el correo y la organización (tenant) del token de ID de Microsoft Entra.
 * El claim `email` es opcional en Microsoft, así que se usa `preferred_username` (el UPN, cuyo dominio
 * tiene que estar verificado en el tenant) cuando no viene. Se rechazan las cuentas personales y las invitadas.
 */
export function microsoftIdentityFromClaims(claims: Record<string, unknown> | undefined): MicrosoftIdentity {
  const tenantId = typeof claims?.tid === 'string' ? claims.tid.toLowerCase() : '';
  if (!isTenantId(tenantId)) throw new UnauthorizedError('La cuenta de Microsoft no informa su organización');
  if (tenantId === MICROSOFT_PERSONAL_TENANT) {
    throw new ForbiddenError('Usá tu cuenta institucional de Microsoft 365, no una cuenta personal.');
  }
  const upn = typeof claims?.preferred_username === 'string' ? claims.preferred_username : '';
  const guest = upn.includes('#EXT#') || claims?.acct === 1 || claims?.acct === '1';
  if (guest) throw new ForbiddenError('Las cuentas invitadas de Microsoft no pueden ingresar a Habitar.');
  const raw = typeof claims?.email === 'string' && claims.email ? claims.email : upn;
  const email = raw.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new UnauthorizedError('La cuenta no expone un email verificado');
  return { email, tenantId };
}

/**
 * La institución tiene que tener cargado su tenant de Microsoft y la cuenta tiene que venir de ese tenant.
 * Sin este control, el administrador de cualquier otro tenant podría crear una cuenta con el correo de un
 * docente de la escuela y entrar en su nombre.
 */
export function assertMicrosoftTenant(institution: { microsoftTenantId: string | null }, tenantId: string): void {
  const expected = institution.microsoftTenantId?.toLowerCase() ?? null;
  if (!expected || expected !== tenantId.toLowerCase()) {
    throw new ForbiddenError('Tu cuenta de Microsoft no pertenece a la organización de la institución registrada en Habitar.');
  }
}
