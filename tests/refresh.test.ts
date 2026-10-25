import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideRefresh, hashRefreshToken, ROTATION_GRACE_MS } from '../src/bll/refresh-session.service';

const now = Date.parse('2026-10-25T12:00:00Z');
const future = new Date(now + 24 * 60 * 60 * 1000);

test('refresh token vigente y sin usar: se rota', () => {
  assert.equal(decideRefresh({ expiresAt: future, rotatedAt: null, revokedAt: null }, now), 'ROTATE');
});

test('refresh token vencido: hay que volver a ingresar', () => {
  assert.equal(decideRefresh({ expiresAt: new Date(now - 1000), rotatedAt: null, revokedAt: null }, now), 'EXPIRED');
});

test('refresh token cerrado con logout: no sirve', () => {
  assert.equal(decideRefresh({ expiresAt: future, rotatedAt: null, revokedAt: new Date(now - 1000) }, now), 'REVOKED');
});

test('dos pestañas renovando a la vez: la segunda entra en el margen de gracia', () => {
  const rotatedAt = new Date(now - (ROTATION_GRACE_MS - 1000));
  assert.equal(decideRefresh({ expiresAt: future, rotatedAt, revokedAt: rotatedAt }, now), 'GRACE');
});

test('reutilizar un refresh token ya rotado fuera del margen: se considera robo', () => {
  const rotatedAt = new Date(now - (ROTATION_GRACE_MS + 1000));
  assert.equal(decideRefresh({ expiresAt: future, rotatedAt, revokedAt: rotatedAt }, now), 'REUSED');
});

test('el refresh token se guarda hasheado', () => {
  const hash = hashRefreshToken('abc');
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, 'abc');
});
