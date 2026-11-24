export type MembershipChoice<M> =
  | { kind: 'one'; membership: M }
  | { kind: 'choose'; options: M[] }
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
  return { kind: 'one', membership: ok[0] ?? memberships[0] };
}
