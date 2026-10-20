import type { Request, Response } from 'express';

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

export function normalizeSearch(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function pageOf<T>(items: T[], total: number, req: PageRequest): Page<T> {
  return { items, total, page: req.page, pageSize: req.pageSize, totalPages: Math.max(1, Math.ceil(total / req.pageSize)) };
}

export function paginate<T>(items: T[], req: PageRequest, searchable?: (item: T) => string): Page<T> {
  const q = normalizeSearch(req.q);
  const filtered = q && searchable ? items.filter((item) => normalizeSearch(searchable(item)).includes(q)) : items;
  const start = (req.page - 1) * req.pageSize;
  return pageOf(filtered.slice(start, start + req.pageSize), filtered.length, req);
}

function textFields(item: unknown): string {
  return item && typeof item === 'object'
    ? Object.values(item as Record<string, unknown>).filter((v) => typeof v === 'string').join(' ')
    : String(item ?? '');
}

export function sendList<T>(req: Request, res: Response, items: T[], searchable: (item: T) => string = textFields): void {
  const page = readPage(req);
  res.json(page ? paginate(items, page, searchable) : items);
}
