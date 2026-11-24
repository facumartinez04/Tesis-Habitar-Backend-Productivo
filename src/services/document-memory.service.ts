import { ConflictError } from '../utils/http-error';

export interface MemoryDocument {
  fileName: string;
  mimeType: string;
  pages: number[] | null;
  data: Buffer;
}

interface Entry extends MemoryDocument {
  expiresAt: number;
}

const MB = 1024 * 1024;
export const MAX_MEMORY_BYTES = Math.max(32, Number(process.env.DOCUMENT_MEMORY_MB) || 256) * MB;
const MIN_TTL_MS = 60 * 60 * 1000;
const MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AFTER_CLOSE_MS = 40 * 60 * 1000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export function documentExpiry(closesAt: Date | null, now = Date.now()): number {
  const wanted = closesAt ? closesAt.getTime() + AFTER_CLOSE_MS : now + DEFAULT_TTL_MS;
  return Math.min(Math.max(wanted, now + MIN_TTL_MS), now + MAX_TTL_MS);
}

export class DocumentMemory {
  private readonly store = new Map<string, Entry>();
  private total = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly maxBytes = MAX_MEMORY_BYTES,
    private readonly now: () => number = Date.now,
  ) {}

  start(everyMs = 60_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.sweep(), everyMs);
    this.timer.unref?.();
  }

  put(activityId: string, doc: MemoryDocument, expiresAt: number): void {
    this.sweep();
    const previous = this.store.get(activityId);
    const without = this.total - (previous?.data.length ?? 0);
    if (without + doc.data.length > this.maxBytes) {
      throw new ConflictError('El servidor tiene muchos documentos en uso en este momento. Probá de nuevo en unos minutos.');
    }
    this.store.set(activityId, { ...doc, expiresAt });
    this.total = without + doc.data.length;
  }

  get(activityId: string): MemoryDocument | null {
    const entry = this.store.get(activityId);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.remove(activityId);
      return null;
    }
    const { expiresAt: _expiresAt, ...doc } = entry;
    return doc;
  }

  has(activityId: string): boolean {
    return this.get(activityId) !== null;
  }

  copy(fromId: string, toId: string, expiresAt: number): boolean {
    const doc = this.get(fromId);
    if (!doc) return false;
    this.put(toId, doc, expiresAt);
    return true;
  }

  remove(activityId: string): void {
    const entry = this.store.get(activityId);
    if (!entry) return;
    this.total -= entry.data.length;
    this.store.delete(activityId);
  }

  sweep(): number {
    const now = this.now();
    let removed = 0;
    for (const [id, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.remove(id);
        removed += 1;
      }
    }
    return removed;
  }

  stats(): { documents: number; bytes: number; maxBytes: number } {
    return { documents: this.store.size, bytes: this.total, maxBytes: this.maxBytes };
  }
}

export const documentMemory = new DocumentMemory();
documentMemory.start();
