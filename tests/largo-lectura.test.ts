import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertReadingLength, DOCUMENT_READING_MAX_CHARS, readingLimit } from '../src/bll/activity.service';

test('el texto pegado a mano se limita por el largo de la institución', () => {
  assert.equal(readingLimit(5000), 5000);
  assert.equal(readingLimit(undefined), 5000);
  assert.equal(readingLimit(null, false), 5000);
  assert.throws(() => assertReadingLength('a'.repeat(5001), readingLimit(5000)), /permite hasta 5000/);
});

test('el texto de un documento no se limita por el largo de la institución sino por el techo técnico', () => {
  assert.equal(readingLimit(5000, true), DOCUMENT_READING_MAX_CHARS);
  assert.doesNotThrow(() => assertReadingLength('a'.repeat(30000), readingLimit(5000, true)));
  assert.throws(() => assertReadingLength('a'.repeat(DOCUMENT_READING_MAX_CHARS + 1), readingLimit(5000, true)));
});

test('una institución con un largo mayor al techo conserva el suyo', () => {
  assert.equal(readingLimit(60000, true), 60000);
});
