import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { aiQuestionGenerator } from '../src/services/ai-question-generator.service';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function mockAi(content: unknown) {
  const calls: { messages: { role: string; content: string }[]; temperature: number }[] = [];
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    calls.push(JSON.parse(init?.body ?? '{}'));
    return new Response(
      JSON.stringify({ model: 'deepseek-chat', usage: { prompt_tokens: 10, completion_tokens: 5 }, choices: [{ message: { content: JSON.stringify(content) } }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;
  return calls;
}

const options = { provider: 'DEEPSEEK' as const, apiKey: 'test' };

test('página escaneada: manda el OCR como dato y devuelve el texto recuperado', async () => {
  const calls = mockAi({ text: '  Hay palabras cargadas con flechas.  ', legible: true });
  const result = await aiQuestionGenerator.cleanScannedPage('E y n\nHay palabras cargadas con flechas e N 4 E x', options);
  assert.deepEqual(result, { text: 'Hay palabras cargadas con flechas.', legible: true });
  assert.equal(calls[0].temperature, 0);
  assert.match(calls[0].messages[0].content, /NO agregues, resumas, traduzcas ni inventes/);
  assert.match(calls[0].messages[1].content, /Hay palabras cargadas con flechas e N 4 E x/);
});

test('página escaneada: sin texto recuperable queda como no legible', async () => {
  mockAi({ text: '   ', legible: true });
  const result = await aiQuestionGenerator.cleanScannedPage('— — > —', options);
  assert.deepEqual(result, { text: '', legible: false });
});

test('página escaneada: una respuesta con otro formato es un error del proveedor', async () => {
  mockAi({ answer: 'otra cosa' });
  await assert.rejects(() => aiQuestionGenerator.cleanScannedPage('texto', options), /no cumple la estructura esperada/);
});
