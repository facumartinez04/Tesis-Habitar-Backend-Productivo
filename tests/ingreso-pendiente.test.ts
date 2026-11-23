import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { signPendingLogin, verifyPendingLogin } from '../src/bll/pending-login';
import { signToken, verifyToken } from '../src/utils/jwt';
import { env } from '../src/config/env';
import type { LoginIdentity } from '../src/bll/auth.service';

const google: LoginIdentity = { provider: 'GOOGLE', email: 'docente@colegio.edu.ar', name: 'Docente Prueba', microsoft: null };
const microsoft: LoginIdentity = {
  provider: 'MICROSOFT',
  email: 'docente@hotmail.com',
  name: null,
  microsoft: { email: 'docente@hotmail.com', tenantId: '9188040d-6c67-4c5b-b112-36a304b66dad', personal: true, domainVerified: false },
};

test('ingreso pendiente: ida y vuelta con Google y con Microsoft', () => {
  assert.deepEqual(verifyPendingLogin(signPendingLogin(google)), google);
  assert.deepEqual(verifyPendingLogin(signPendingLogin(microsoft)), microsoft);
});

test('un token de sesión de Habitar no sirve como ingreso pendiente', () => {
  const session = signToken({ sub: 'u1', role: 'DOCENTE', institutionId: 'i1', provider: 'GOOGLE' });
  assert.equal(verifyPendingLogin(session), null);
  const sameSecret = jwt.sign({ provider: 'GOOGLE', email: 'x@y.com', name: null, microsoft: null }, env.jwtSecret, { audience: 'habitar-ingreso-pendiente' });
  assert.equal(verifyPendingLogin(sameSecret), null);
});

test('un ingreso pendiente no sirve como sesión de Habitar', () => {
  assert.throws(() => verifyToken(signPendingLogin(google)));
});

test('ingreso pendiente vencido, ausente o adulterado: null', () => {
  const expired = jwt.sign({ provider: 'GOOGLE', email: 'x@y.com', name: null, microsoft: null }, `${env.jwtSecret}:ingreso-pendiente`, {
    audience: 'habitar-ingreso-pendiente',
    expiresIn: -10,
  });
  assert.equal(verifyPendingLogin(expired), null);
  assert.equal(verifyPendingLogin(undefined), null);
  assert.equal(verifyPendingLogin(signPendingLogin(google) + 'x'), null);
});

test('Microsoft sin los datos de su organización: null', () => {
  const broken = jwt.sign({ provider: 'MICROSOFT', email: 'x@y.com', name: null, microsoft: null }, `${env.jwtSecret}:ingreso-pendiente`, {
    audience: 'habitar-ingreso-pendiente',
    expiresIn: 60,
  });
  assert.equal(verifyPendingLogin(broken), null);
});
