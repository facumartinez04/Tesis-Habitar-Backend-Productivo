import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmailLimiter, EMAIL_LIMITS } from '../src/utils/email-limiter';

const now = Date.parse('2026-11-22T12:00:00Z');
const HORA = 60 * 60 * 1000;

test('invitaciones: hasta 3 por destinatario en 24 horas', () => {
  const l = new EmailLimiter();
  for (let i = 0; i < EMAIL_LIMITS.INVITACION.max; i++) assert.equal(l.allow('INVITACION', 'ana@colegio.edu.ar', now + i), true);
  assert.equal(l.allow('INVITACION', 'ana@colegio.edu.ar', now + 10), false);
});

test('el límite no distingue mayúsculas ni espacios en la dirección', () => {
  const l = new EmailLimiter({ INVITACION: { max: 1, windowMs: HORA }, CAMBIO_ROL: { max: 1, windowMs: HORA }, ALERTA: { max: 1, windowMs: HORA } });
  assert.equal(l.allow('INVITACION', 'Ana@Colegio.edu.ar ', now), true);
  assert.equal(l.allow('INVITACION', 'ana@colegio.edu.ar', now + 1), false);
});

test('cada tipo de correo y cada destinatario tienen su propio límite', () => {
  const l = new EmailLimiter({ INVITACION: { max: 1, windowMs: HORA }, CAMBIO_ROL: { max: 1, windowMs: HORA }, ALERTA: { max: 1, windowMs: HORA } });
  assert.equal(l.allow('INVITACION', 'ana@colegio.edu.ar', now), true);
  assert.equal(l.allow('CAMBIO_ROL', 'ana@colegio.edu.ar', now), true);
  assert.equal(l.allow('INVITACION', 'luis@colegio.edu.ar', now), true);
});

test('pasada la ventana se puede volver a enviar', () => {
  const l = new EmailLimiter();
  for (let i = 0; i < EMAIL_LIMITS.CAMBIO_ROL.max; i++) l.allow('CAMBIO_ROL', 'ana@colegio.edu.ar', now + i);
  assert.equal(l.allow('CAMBIO_ROL', 'ana@colegio.edu.ar', now + HORA - 1), false);
  assert.equal(l.allow('CAMBIO_ROL', 'ana@colegio.edu.ar', now + HORA + 10), true);
});
