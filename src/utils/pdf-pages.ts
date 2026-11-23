import { PDFDocument } from 'pdf-lib';
import { BadRequestError } from './http-error';

/** Máximo de páginas que se leen de una vez con IA. */
export const MAX_AI_PAGES = 60;

/** «1, 3,4» → [1, 3, 4]. Devuelve null si no se indicó ninguna (se usa todo el documento). */
export function parsePageList(raw: string | undefined): number[] | null {
  if (!raw?.trim()) return null;
  const pages = [...new Set(raw.split(',').map((p) => Number.parseInt(p, 10)))].filter((n) => Number.isInteger(n) && n >= 1 && n <= 5000);
  if (pages.length === 0) throw new BadRequestError('La selección de páginas no es válida');
  return pages.sort((a, b) => a - b);
}

export function isPdf(data: Buffer): boolean {
  return data.subarray(0, 5).toString('latin1') === '%PDF-';
}

/** Páginas por tanda cuando se lee en paralelo: tandas chicas terminan antes porque el modelo escribe menos texto en cada una. */
export const AI_CHUNK_PAGES = 3;

/**
 * Arma PDF nuevos solo con las páginas elegidas, en tandas de `chunkSize` páginas (en orden): de Habitar sale
 * únicamente lo que el docente marcó. Sin selección usa todo el documento.
 */
export async function splitPdfPages(
  data: Buffer,
  pages: number[] | null,
  chunkSize: number,
): Promise<{ chunks: Buffer[]; pageCount: number; used: number }> {
  let source: PDFDocument;
  try {
    source = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    throw new BadRequestError('No se pudo abrir el PDF');
  }
  const pageCount = source.getPageCount();
  const indices = (pages ?? Array.from({ length: pageCount }, (_, i) => i + 1)).filter((n) => n <= pageCount).map((n) => n - 1);
  if (indices.length === 0) throw new BadRequestError('Las páginas elegidas no existen en el documento');
  if (indices.length > MAX_AI_PAGES) throw new BadRequestError(`Se pueden leer hasta ${MAX_AI_PAGES} páginas a la vez`);
  const chunks: Buffer[] = [];
  for (let i = 0; i < indices.length; i += chunkSize) {
    const out = await PDFDocument.create();
    const copied = await out.copyPages(source, indices.slice(i, i + chunkSize));
    copied.forEach((p) => out.addPage(p));
    chunks.push(Buffer.from(await out.save()));
  }
  return { chunks, pageCount, used: indices.length };
}

/** Un solo PDF con las páginas elegidas. */
export async function selectPdfPages(data: Buffer, pages: number[] | null): Promise<{ data: Buffer; pageCount: number; used: number }> {
  const { chunks, pageCount, used } = await splitPdfPages(data, pages, MAX_AI_PAGES);
  return { data: chunks[0], pageCount, used };
}

/** Ejecuta `task` sobre cada elemento con hasta `limit` en simultáneo y devuelve los resultados en el mismo orden. */
export async function mapWithLimit<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
