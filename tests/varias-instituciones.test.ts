import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectMembership } from '../src/bll/membership';
import { ChooseInstitutionError } from '../src/bll/auth.service';

interface M {
  institutionId: string;
  ok: boolean;
}
const cuenta = (institutionId: string, ok = true): M => ({ institutionId, ok });
const elegir = (ms: M[], chosen?: string) => selectMembership(ms, (m) => m.institutionId, (m) => m.ok, chosen);

test('con una sola cuenta entra directo, como siempre', () => {
  const r = elegir([cuenta('A')]);
  assert.deepEqual(r, { kind: 'one', membership: cuenta('A') });
});

test('con una sola cuenta con problema también la devuelve (el llamador informa el problema)', () => {
  assert.deepEqual(elegir([cuenta('A', false)]), { kind: 'one', membership: cuenta('A', false) });
});

test('con dos cuentas usables hay que elegir', () => {
  const r = elegir([cuenta('A'), cuenta('B')]);
  assert.equal(r.kind, 'choose');
  assert.deepEqual(r.kind === 'choose' && r.options.map((m) => m.institutionId), ['A', 'B']);
});

test('si solo una de las cuentas se puede usar, entra a esa sin preguntar', () => {
  assert.deepEqual(elegir([cuenta('A', false), cuenta('B')]), { kind: 'one', membership: cuenta('B') });
  assert.deepEqual(elegir([cuenta('A'), cuenta('B', false)]), { kind: 'one', membership: cuenta('A') });
});

test('si ninguna se puede usar, se informa el problema de la primera', () => {
  assert.deepEqual(elegir([cuenta('A', false), cuenta('B', false)]), { kind: 'one', membership: cuenta('A', false) });
});

test('al elegir, entra a la cuenta elegida; una que no es suya se rechaza', () => {
  assert.deepEqual(elegir([cuenta('A'), cuenta('B')], 'B'), { kind: 'one', membership: cuenta('B') });
  assert.deepEqual(elegir([cuenta('A'), cuenta('B')], 'C'), { kind: 'unknown' });
  assert.deepEqual(elegir([cuenta('A')], 'B'), { kind: 'unknown' });
});

test('sin cuentas no hay nada que elegir', () => {
  assert.deepEqual(elegir([]), { kind: 'unknown' });
});

test('elegir una cuenta con problema no se saltea el problema (se devuelve para que se informe)', () => {
  assert.deepEqual(elegir([cuenta('A'), cuenta('B', false)], 'B'), { kind: 'one', membership: cuenta('B', false) });
});

test('el aviso de elegir institución lleva las opciones', () => {
  const err = new ChooseInstitutionError([{ id: 'A', name: 'Colegio A' }, { id: 'B', name: 'Colegio B' }]);
  assert.equal(err.message, 'Elegí la institución a la que querés entrar');
  assert.equal(err.choices.length, 2);
  assert.ok(err instanceof Error);
});
