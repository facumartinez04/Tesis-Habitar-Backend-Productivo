import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentMemory, documentExpiry } from '../src/services/document-memory.service';
import { detectMime } from '../src/bll/activity-document.service';
import { DOCX_MIME, PDF_MIME, PPTX_MIME } from '../src/dal/activity-document.repository';

const HORA = 60 * 60 * 1000;
const doc = (bytes: number, name = 'a.pdf') => ({ fileName: name, mimeType: PDF_MIME, pages: null, data: Buffer.alloc(bytes, 1) });

test('el documento vive en memoria y se borra solo al vencer', () => {
  let ahora = 1_000_000;
  const mem = new DocumentMemory(10_000, () => ahora);
  mem.put('act-1', doc(100), ahora + 2 * HORA);
  assert.equal(mem.get('act-1')?.fileName, 'a.pdf');
  assert.equal(mem.stats().documents, 1);
  ahora += HORA;
  assert.ok(mem.get('act-1'), 'sigue antes del vencimiento');
  ahora += HORA + 1;
  assert.equal(mem.get('act-1'), null, 'vencido: ya no se entrega');
  assert.deepEqual(mem.stats(), { documents: 0, bytes: 0, maxBytes: 10_000 });
});

test('el barrido borra los vencidos y deja los vigentes', () => {
  let ahora = 0;
  const mem = new DocumentMemory(10_000, () => ahora);
  mem.put('corta', doc(10), 100);
  mem.put('larga', doc(20), 1000);
  ahora = 500;
  assert.equal(mem.sweep(), 1);
  assert.equal(mem.get('corta'), null);
  assert.ok(mem.get('larga'));
  assert.equal(mem.stats().bytes, 20);
});

test('borrar un documento libera su memoria y reemplazarlo no la duplica', () => {
  const mem = new DocumentMemory(1000, () => 0);
  mem.put('x', doc(400), 10);
  mem.put('x', doc(300), 10);
  assert.equal(mem.stats().bytes, 300);
  mem.remove('x');
  assert.equal(mem.stats().bytes, 0);
  mem.remove('no-existe');
});

test('hay un tope de memoria: si no entra, se rechaza y no se pierde lo que ya estaba', () => {
  const mem = new DocumentMemory(1000, () => 0);
  mem.put('a', doc(600), 10);
  assert.throws(() => mem.put('b', doc(500), 10), /muchos documentos en uso/);
  assert.ok(mem.get('a'));
  assert.equal(mem.get('b'), null);
  const mem2 = new DocumentMemory(1000, () => 20);
  mem2.put('a', doc(600), 10);
  mem2.put('b', doc(500), 100);
  assert.ok(mem2.get('b'));
});

test('copiar el documento a otra actividad (al duplicarla)', () => {
  const mem = new DocumentMemory(10_000, () => 0);
  mem.put('origen', { ...doc(50, 'lectura.pdf'), pages: [1, 2] }, 100);
  assert.equal(mem.copy('origen', 'copia', 200), true);
  assert.deepEqual(mem.get('copia')?.pages, [1, 2]);
  assert.equal(mem.copy('no-hay', 'otra', 200), false);
  mem.remove('origen');
  assert.ok(mem.get('copia'), 'la copia es independiente');
});

test('vencimiento: un rato después del cierre, entre una hora y 30 días', () => {
  const ahora = 1_800_000_000_000;
  const cierre = new Date(ahora + 5 * HORA);
  assert.equal(documentExpiry(cierre, ahora), cierre.getTime() + 40 * 60 * 1000);
  assert.equal(documentExpiry(new Date(ahora - 10 * HORA), ahora), ahora + HORA, 'ya cerrada: mínimo una hora');
  assert.equal(documentExpiry(new Date(ahora + 90 * 24 * HORA), ahora), ahora + 30 * 24 * HORA, 'tope de 30 días');
  assert.equal(documentExpiry(null, ahora), ahora + 24 * HORA, 'sin cierre: un día');
});

test('detecta PDF, Word y PowerPoint por su contenido (no por el nombre)', () => {
  const zip = (...partes: string[]) => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(partes.join(' '))]);
  assert.equal(detectMime(Buffer.from('%PDF-1.7 ...')), PDF_MIME);
  assert.equal(detectMime(zip('word/document.xml')), DOCX_MIME);
  assert.equal(detectMime(zip('[Content_Types].xml', 'ppt/presentation.xml', 'ppt/slides/slide1.xml')), PPTX_MIME);
  assert.equal(detectMime(zip('xl/workbook.xml')), null, 'Excel no');
  assert.equal(detectMime(Buffer.from('texto cualquiera')), null);
});
