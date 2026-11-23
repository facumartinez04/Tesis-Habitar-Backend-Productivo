/**
 * Una misma persona (el mismo correo) puede tener una cuenta en cada institución. Al ingresar hay que decidir a cuál
 * entra. Esta función solo decide (no toca la base) y se prueba aparte.
 */
export type MembershipChoice<M> =
  /** Entra directamente a esta cuenta (aunque tenga un problema: el llamador lo informa). */
  | { kind: 'one'; membership: M }
  /** Hay más de una cuenta usable: la persona tiene que elegir. */
  | { kind: 'choose'; options: M[] }
  /** La cuenta elegida no es de esta persona. */
  | { kind: 'unknown' };

export function selectMembership<M>(
  memberships: M[],
  institutionIdOf: (m: M) => string,
  usable: (m: M) => boolean,
  chosenInstitutionId?: string,
): MembershipChoice<M> {
  if (memberships.length === 0) return { kind: 'unknown' };
  if (chosenInstitutionId) {
    const chosen = memberships.find((m) => institutionIdOf(m) === chosenInstitutionId);
    return chosen ? { kind: 'one', membership: chosen } : { kind: 'unknown' };
  }
  if (memberships.length === 1) return { kind: 'one', membership: memberships[0] };
  const ok = memberships.filter(usable);
  if (ok.length > 1) return { kind: 'choose', options: ok };
  // Una sola usable: entra a esa. Ninguna: se muestra el problema de la primera cuenta.
  return { kind: 'one', membership: ok[0] ?? memberships[0] };
}
