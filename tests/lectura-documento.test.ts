import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PDFDocument } from 'pdf-lib';
import { aiQuestionGenerator } from '../src/services/ai-question-generator.service';
import { filesUrlFor } from '../src/services/deepseek-files.service';
import { isPdf, MAX_AI_PAGES, parsePageList, selectPdfPages } from '../src/utils/pdf-pages';

async function pdfDe(paginas: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < paginas; i += 1) doc.addPage([200, 200]);
  return Buffer.from(await doc.save());
}

const leer = (req: IncomingMessage) =>
  new Promise<Buffer>((resolve) => {
    const partes: Buffer[] = [];
    req.on('data', (c) => partes.push(c));
    req.on('end', () => resolve(Buffer.concat(partes)));
  });

/** DeepSeek simulado: registra lo que recibe. */
async function deepseekFalso(opciones: { chat: (cuerpo: any) => { status: number; json: unknown } }) {
  const visto = { subidas: [] as string[], borrados: [] as string[], chats: [] as any[], auth: [] as string[] };
  const server = createServer(async (req, res) => {
    visto.auth.push(String(req.headers.authorization));
    const cuerpo = await leer(req);
    if (req.method === 'POST' && req.url === '/files') {
      visto.subidas.push(cuerpo.toString('latin1'));
      res.setHeader('content-type', 'application/json').end(JSON.stringify({ id: 'file-api-prueba', object: 'file' }));
    } else if (req.method === 'POST' && req.url === '/chat/completions') {
      const json = JSON.parse(cuerpo.toString('utf8'));
      visto.chats.push(json);
      const r = opciones.chat(json);
      res.statusCode = r.status;
      res.setHeader('content-type', 'application/json').end(JSON.stringify(r.json));
    } else if (req.method === 'DELETE' && req.url?.startsWith('/files/')) {
      visto.borrados.push(decodeURIComponent(req.url.slice('/files/'.length)));
      res.setHeader('content-type', 'application/json').end(JSON.stringify({ deleted: true }));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/chat/completions`;
  return { url, visto, cerrar: () => new Promise<void>((r) => server.close(() => r())) };
}

test('lectura con IA: sube el PDF, lo referencia por file_id, devuelve el texto y borra el archivo', async () => {
  const falso = await deepseekFalso({
    chat: () => ({ status: 200, json: { model: 'deepseek-flash', choices: [{ message: { content: 'ALGORITMOS GENÉTICOS\n\nOptimización inspirada en la evolución.' } }], usage: { prompt_tokens: 900, completion_tokens: 40 } } }),
  });
  try {
    const usos: unknown[] = [];
    const res = await aiQuestionGenerator.readDocument(await pdfDe(2), { provider: 'DEEPSEEK', apiKey: 'clave-de-prueba', apiUrl: falso.url, onUsage: (u) => usos.push(u) });
    assert.equal(res.legible, true);
    assert.match(res.text, /ALGORITMOS GENÉTICOS/);
    // El campo purpose viaja antes que el archivo (si no, DeepSeek responde 400) y se pide la lectura con figuras.
    const subida = falso.visto.subidas[0];
    assert.ok(subida.indexOf('name="purpose"') >= 0 && subida.indexOf('name="purpose"') < subida.indexOf('name="file"'));
    assert.match(subida, /rich_layout_recognition/);
    assert.match(subida, /expires_after\[seconds\]/);
    // El chat usa deepseek-flash y referencia el archivo con la forma documentada.
    const chat = falso.visto.chats[0];
    assert.equal(chat.model, 'deepseek-flash');
    const contenido = chat.messages[1].content;
    assert.deepEqual(contenido[0], { type: 'file', file_id: 'file-api-prueba' });
    assert.equal(contenido[1].type, 'text');
    assert.deepEqual(falso.visto.borrados, ['file-api-prueba']);
    assert.ok(falso.visto.auth.every((a) => a === 'Bearer clave-de-prueba'));
    assert.deepEqual(usos[0], { model: 'deepseek-flash', promptTokens: 900, completionTokens: 40 });
  } finally {
    await falso.cerrar();
  }
});

test('lectura con IA: si el chat falla, igual se borra el archivo subido', async () => {
  const falso = await deepseekFalso({ chat: () => ({ status: 500, json: { error: { message: 'caído' } } }) });
  try {
    await assert.rejects(aiQuestionGenerator.readDocument(await pdfDe(1), { provider: 'DEEPSEEK', apiKey: 'k', apiUrl: falso.url }), /respondió con error 500/);
    assert.deepEqual(falso.visto.borrados, ['file-api-prueba']);
  } finally {
    await falso.cerrar();
  }
});

test('lectura con IA: un documento sin texto de lectura vuelve como no legible', async () => {
  const falso = await deepseekFalso({ chat: () => ({ status: 200, json: { choices: [{ message: { content: '[[SIN_TEXTO]]' } }] } }) });
  try {
    const res = await aiQuestionGenerator.readDocument(await pdfDe(1), { provider: 'DEEPSEEK', apiKey: 'k', apiUrl: falso.url });
    assert.deepEqual(res, { text: '', legible: false });
  } finally {
    await falso.cerrar();
  }
});

test('lectura con IA: solo con DeepSeek y con clave', async () => {
  await assert.rejects(aiQuestionGenerator.readDocument(await pdfDe(1), { provider: 'OPENAI', apiKey: 'k' }), /solo está disponible con DeepSeek/);
  await assert.rejects(aiQuestionGenerator.readDocument(await pdfDe(1), { provider: 'DEEPSEEK', apiKey: '  ' }), /No hay clave/);
});

test('la dirección de /files sale de la del chat', () => {
  assert.equal(filesUrlFor('https://api.deepseek.com/chat/completions'), 'https://api.deepseek.com/files');
});

test('recorte de páginas: solo viaja lo que el docente eligió', async () => {
  const pdf = await pdfDe(5);
  assert.ok(isPdf(pdf));
  const una = await selectPdfPages(pdf, [2, 4]);
  assert.equal(una.pageCount, 5);
  assert.equal(una.used, 2);
  assert.equal((await PDFDocument.load(una.data)).getPageCount(), 2);
  assert.equal((await selectPdfPages(pdf, null)).used, 5);
  // Las páginas que no existen se ignoran; si no queda ninguna, error.
  assert.equal((await selectPdfPages(pdf, [4, 99])).used, 1);
  await assert.rejects(selectPdfPages(pdf, [99]), /no existen/);
  await assert.rejects(selectPdfPages(Buffer.from('%PDF-roto'), null), /No se pudo abrir el PDF/);
});

test('recorte de páginas: hay un tope de páginas por lectura', async () => {
  const grande = await pdfDe(MAX_AI_PAGES + 1);
  await assert.rejects(selectPdfPages(grande, null), /hasta 60 páginas/);
  assert.equal((await selectPdfPages(grande, [1, 2, 3])).used, 3);
});

test('lista de páginas de la cabecera', () => {
  assert.deepEqual(parsePageList('3, 1,2,2'), [1, 2, 3]);
  assert.equal(parsePageList(undefined), null);
  assert.equal(parsePageList('  '), null);
  assert.throws(() => parsePageList('a,b'), /no es válida/);
});
