import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MICROSOFT_PERSONAL_TENANT,
  assertMicrosoftEmailTrusted,
  isTenantId,
  microsoftIdentityFromClaims,
} from '../src/bll/microsoft-identity';

const TENANT = '72f988bf-86f1-41af-91ab-2d7cd011db47';
const OTRO = '0b2c1f3e-1111-4a2b-9c3d-123456789abc';
const sinVincular = { microsoftTenantId: null };

test('cuenta personal (Hotmail/Outlook): se acepta, Microsoft verifica su correo', () => {
  const id = microsoftIdentityFromClaims({ tid: MICROSOFT_PERSONAL_TENANT, email: 'Docente@Hotmail.com', preferred_username: 'docente@hotmail.com' });
  assert.deepEqual(id, { email: 'docente@hotmail.com', tenantId: MICROSOFT_PERSONAL_TENANT, personal: true, domainVerified: false });
  assert.doesNotThrow(() => assertMicrosoftEmailTrusted(id, sinVincular));
});

test('cuenta de organización con dominio verificado (xms_edov): se acepta sin vincular el tenant', () => {
  const id = microsoftIdentityFromClaims({ tid: TENANT, email: 'paula@colegio.edu.ar', xms_edov: true });
  assert.equal(id.domainVerified, true);
  assert.doesNotThrow(() => assertMicrosoftEmailTrusted(id, sinVincular));
  assert.equal(microsoftIdentityFromClaims({ tid: TENANT, email: 'a@colegio.edu.ar', xms_edov: '1' }).domainVerified, true);
});

test('organización sin dominio verificado y sin vincular (nOAuth): se rechaza', () => {
  const id = microsoftIdentityFromClaims({ tid: OTRO, email: 'paula@colegio.edu.ar', xms_edov: false });
  assert.throws(() => assertMicrosoftEmailTrusted(id, sinVincular), /institución registrada/);
  assert.throws(() => assertMicrosoftEmailTrusted(id, { microsoftTenantId: TENANT }), /institución registrada/);
});

test('organización vinculada por el administrador: se acepta aunque no venga xms_edov', () => {
  const id = microsoftIdentityFromClaims({ tid: TENANT, preferred_username: 'plopez@colegio.edu.ar' });
  assert.equal(id.email, 'plopez@colegio.edu.ar');
  assert.doesNotThrow(() => assertMicrosoftEmailTrusted(id, { microsoftTenantId: TENANT.toUpperCase() }));
});

test('cuenta invitada (#EXT# o acct = 1): se rechaza', () => {
  assert.throws(
    () => microsoftIdentityFromClaims({ tid: TENANT, email: 'externo@gmail.com', preferred_username: 'externo_gmail.com#EXT#@colegio.onmicrosoft.com' }),
    /invitadas/,
  );
  assert.throws(() => microsoftIdentityFromClaims({ tid: TENANT, email: 'externo@otra.edu.ar', acct: 1 }), /invitadas/);
});

test('token sin tenant o sin correo: se rechaza', () => {
  assert.throws(() => microsoftIdentityFromClaims({ email: 'a@colegio.edu.ar' }), /organización/);
  assert.throws(() => microsoftIdentityFromClaims({ tid: TENANT, preferred_username: 'sin-arroba' }), /email/);
  assert.throws(() => microsoftIdentityFromClaims(undefined), /organización/);
});

test('formato del ID de organización', () => {
  assert.equal(isTenantId(TENANT), true);
  assert.equal(isTenantId('colegio.edu.ar'), false);
  assert.equal(isTenantId(''), false);
});
