import type { Request, Response } from 'express';

/**
 * Paginación de listados. Es opcional: si el pedido trae `?page=`, la respuesta es una página
 * ({ items, total, page, pageSize, totalPages }); si no, el listado completo como antes, para no romper a quien
 * todavía lo pide entero. `q` filtra por texto sin distinguir mayúsculas ni tildes.
 */
export interface PageRequest {
  page: number;
  pageSize: number;
  q: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const MAX_PAGE_SIZE = 100;

export function readPage(req: Request, defaultSize = 20): PageRequest | null {
  if (req.query.page === undefined) return null;
  const page = Math.max(1, Number.parseInt(String(req.query.page), 10) || 1);
  const size = Number.parseInt(String(req.query.pageSize ?? defaultSize), 10) || defaultSize;
  return { page, pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, size)), q: String(req.query.q ?? '').trim().slice(0, 100) };
}

/** Texto para comparar: minúsculas y sin tildes. */
export function normalizeSearch(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function pageOf<T>(items: T[], total: number, req: PageRequest): Page<T> {
  return { items, total, page: req.page, pageSize: req.pageSize, totalPages: Math.max(1, Math.ceil(total / req.pageSize)) };
}

/** Pagina en memoria un listado ya cargado (para tablas que no crecen tanto como para paginar en SQL). */
export function paginate<T>(items: T[], req: PageRequest, searchable?: (item: T) => string): Page<T> {
  const q = normalizeSearch(req.q);
  const filtered = q && searchable ? items.filter((item) => normalizeSearch(searchable(item)).includes(q)) : items;
  const start = (req.page - 1) * req.pageSize;
  return pageOf(filtered.slice(start, start + req.pageSize), filtered.length, req);
}

/** Por defecto se busca en todos los campos de texto del elemento. */
function textFields(item: unknown): string {
  return item && typeof item === 'object'
    ? Object.values(item as Record<string, unknown>).filter((v) => typeof v === 'string').join(' ')
    : String(item ?? '');
}

/** Responde el listado completo o una página, según lo que pidió el cliente. */
export function sendList<T>(req: Request, res: Response, items: T[], searchable: (item: T) => string = textFields): void {
  const page = readPage(req);
  res.json(page ? paginate(items, page, searchable) : items);
}
