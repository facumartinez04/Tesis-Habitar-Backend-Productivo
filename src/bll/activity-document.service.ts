import { activityRepository } from '../dal/activity.repository';
import {
  activityDocumentRepository,
  DOCX_MIME,
  PDF_MIME,
  PPTX_MIME,
  type ActivityDocumentMeta,
  type DocumentMime,
} from '../dal/activity-document.repository';
import { documentExpiry, documentMemory, type MemoryDocument } from '../services/document-memory.service';
import { activityWindow } from './activity-window';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/http-error';

export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

export function detectMime(data: Buffer): DocumentMime | null {
  if (data.subarray(0, 5).toString('latin1') === '%PDF-') return PDF_MIME;
  const zip = data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04;
  if (zip && data.includes('word/document.xml')) return DOCX_MIME;
  if (zip && data.includes('ppt/presentation.xml')) return PPTX_MIME;
  return null;
}

function cleanFileName(raw: string | undefined, mime: DocumentMime): string {
  let name = '';
  try {
    name = decodeURIComponent(raw ?? '');
  } catch {
    name = raw ?? '';
  }
  name = name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 150);
  if (name) return name;
  return mime === PDF_MIME ? 'documento.pdf' : mime === PPTX_MIME ? 'presentacion.pptx' : 'documento.docx';
}

function parsePages(raw: string | undefined): number[] | null {
  if (!raw?.trim()) return null;
  const pages = [...new Set(raw.split(',').map((p) => Number.parseInt(p, 10)))].filter((n) => Number.isInteger(n) && n >= 1 && n <= 5000);
  if (pages.length === 0 || pages.length > 500) throw new BadRequestError('La selección de páginas no es válida');
  return pages.sort((a, b) => a - b);
}

function toMeta(doc: MemoryDocument): ActivityDocumentMeta {
  return { fileName: doc.fileName, mimeType: doc.mimeType as DocumentMime, sizeBytes: doc.data.length, pages: doc.pages };
}

export class ActivityDocumentService {
  async upload(
    activityId: string,
    input: { data: unknown; fileName?: string; pages?: string },
  ): Promise<ActivityDocumentMeta> {
    const activity = await activityRepository.findById(activityId);
    if (!activity) throw new NotFoundError('Actividad no encontrada');
    if (activity.status === 'CERRADA') throw new ConflictError('La actividad ya está cerrada');
    if (!Buffer.isBuffer(input.data) || input.data.length === 0) throw new BadRequestError('No llegó el archivo');
    if (input.data.length > MAX_DOCUMENT_BYTES) throw new BadRequestError('El archivo supera los 15 MB');
    const mimeType = detectMime(input.data);
    if (!mimeType) throw new BadRequestError('Sólo se pueden mostrar a los alumnos archivos PDF, Word (.docx) o PowerPoint (.pptx)');
    const doc: MemoryDocument = {
      fileName: cleanFileName(input.fileName, mimeType),
      mimeType,
      pages: mimeType === PDF_MIME || mimeType === PPTX_MIME ? parsePages(input.pages) : null,
      data: input.data,
    };
    documentMemory.put(activityId, doc, documentExpiry(activityWindow(activity).closesAt));
    await activityDocumentRepository.remove(activityId);
    return toMeta(doc);
  }

  async metaFor(activityId: string): Promise<ActivityDocumentMeta | null> {
    const inMemory = documentMemory.get(activityId);
    if (inMemory) return toMeta(inMemory);
    return activityDocumentRepository.meta(activityId);
  }

  async contentFor(activityId: string): Promise<{ mimeType: string; fileName: string; data: Buffer } | null> {
    return documentMemory.get(activityId) ?? (await activityDocumentRepository.content(activityId));
  }

  async forStudent(code: string): Promise<{ mimeType: string; fileName: string; data: Buffer }> {
    const { openActivity } = await import('./activity-session.service');
    const activity = await openActivity(code);
    const content = await this.contentFor(activity.id);
    if (!content) throw new NotFoundError('Esta actividad no tiene documento');
    return content;
  }

  async copyTo(fromId: string, toId: string): Promise<void> {
    const target = await activityRepository.findById(toId);
    if (!target) return;
    const content = await this.contentFor(fromId);
    if (!content) return;
    const meta = await this.metaFor(fromId);
    documentMemory.put(toId, { fileName: content.fileName, mimeType: content.mimeType, pages: meta?.pages ?? null, data: content.data }, documentExpiry(activityWindow(target).closesAt));
  }

  async attach(activityId: string, doc: MemoryDocument): Promise<void> {
    const activity = await activityRepository.findById(activityId);
    if (!activity) throw new NotFoundError('Actividad no encontrada');
    documentMemory.put(activityId, doc, documentExpiry(activityWindow(activity).closesAt));
  }

  forget(activityId: string): void {
    documentMemory.remove(activityId);
  }
}

export const activityDocumentService = new ActivityDocumentService();
