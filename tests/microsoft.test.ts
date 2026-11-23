import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MICROSOFT_PERSONAL_TENANT,
  assertMicrosoftTenant,
  isTenantId,
  microsoftIdentityFromClaims,
} from '../src/bll/microsoft-identity';

const TENANT = '72f988bf-86f1-41af-91ab-2d7cd011db47';
const OTRO = '0b2c1f3e-1111-4a2b-9c3d-123456789abc';

test('cuenta institucional con email: se usa el email y el tenant', () => {
  const id = microsoftIdentityFromClaims({ tid: TENANT, email: 'Paula.Lopez@Colegio.edu.ar', preferred_username: 'plopez@colegio.edu.ar' });
  assert.deepEqual(id, { email: 'paula.lopez@colegio.edu.ar', tenantId: TENANT });
});

test('sin claim email: se usa preferred_username (UPN)', () => {
  const id = microsoftIdentityFromClaims({ tid: TENANT.toUpperCase(), preferred_username: 'plopez@colegio.edu.ar' });
  assert.deepEqual(id, { email: 'plopez@colegio.edu.ar', tenantId: TENANT });
});

test('cuenta personal de Microsoft: se rechaza', () => {
  assert.throws(
    () => microsoftIdentityFromClaims({ tid: MICROSOFT_PERSONAL_TENANT, email: 'alguien@hotmail.com' }),
    /cuenta personal/,
  );
});

test('cuenta invitada (#EXT#): se rechaza', () => {
  assert.throws(
    () => microsoftIdentityFromClaims({ tid: TENANT, email: 'externo@gmail.com', preferred_username: 'externo_gmail.com#EXT#@colegio.onmicrosoft.com' }),
    /invitadas/,
  );
});

test('cuenta invitada (acct = 1): se rechaza', () => {
  assert.throws(() => microsoftIdentityFromClaims({ tid: TENANT, email: 'externo@otra.edu.ar', acct: 1 }), /invitadas/);
});

test('token sin tenant o sin correo: se rechaza', () => {
  assert.throws(() => microsoftIdentityFromClaims({ email: 'a@colegio.edu.ar' }), /organización/);
  assert.throws(() => microsoftIdentityFromClaims({ tid: TENANT, preferred_username: 'sin-arroba' }), /email/);
  assert.throws(() => microsoftIdentityFromClaims(undefined), /organización/);
});

test('el tenant de la cuenta coincide con el de la institución: pasa', () => {
  assert.doesNotThrow(() => assertMicrosoftTenant({ microsoftTenantId: TENANT.toUpperCase() }, TENANT));
});

test('cuenta de otro tenant con el dominio de la escuela (nOAuth): se rechaza', () => {
  assert.throws(() => assertMicrosoftTenant({ microsoftTenantId: TENANT }, OTRO), /institución registrada/);
});

test('institución sin tenant cargado: no se puede ingresar con Microsoft', () => {
  assert.throws(() => assertMicrosoftTenant({ microsoftTenantId: null }, TENANT), /institución registrada/);
});

test('formato del ID de organización', () => {
  assert.equal(isTenantId(TENANT), true);
  assert.equal(isTenantId('colegio.edu.ar'), false);
  assert.equal(isTenantId(''), false);
});
