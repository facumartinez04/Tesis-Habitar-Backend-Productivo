import { query, queryOne } from '../config/db';

export const PDF_MIME = 'application/pdf';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export type DocumentMime = typeof PDF_MIME | typeof DOCX_MIME;

/** Lo que el alumno necesita saber del documento, sin el contenido. */
export interface ActivityDocumentMeta {
  fileName: string;
  mimeType: DocumentMime;
  sizeBytes: number;
  /** Páginas del PDF a mostrar; null = todas. */
  pages: number[] | null;
}

interface MetaRow {
  fileName: string;
  mimeType: DocumentMime;
  sizeBytes: number;
  pagesJson: string | null;
}

function toMeta(row: MetaRow): ActivityDocumentMeta {
  return { fileName: row.fileName, mimeType: row.mimeType, sizeBytes: row.sizeBytes, pages: row.pagesJson ? (JSON.parse(row.pagesJson) as number[]) : null };
}

export class SqlActivityDocumentRepository {
  async save(activityId: string, input: { fileName: string; mimeType: DocumentMime; pages: number[] | null; data: Buffer }): Promise<ActivityDocumentMeta> {
    const row = await queryOne<MetaRow>(
      `INSERT INTO "ActivityDocument" ("activityId", "fileName", "mimeType", "sizeBytes", "pagesJson", "data")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("activityId") DO UPDATE SET
         "fileName" = EXCLUDED."fileName", "mimeType" = EXCLUDED."mimeType", "sizeBytes" = EXCLUDED."sizeBytes",
         "pagesJson" = EXCLUDED."pagesJson", "data" = EXCLUDED."data", "createdAt" = CURRENT_TIMESTAMP
       RETURNING "fileName", "mimeType", "sizeBytes", "pagesJson"`,
      [activityId, input.fileName, input.mimeType, input.data.length, input.pages ? JSON.stringify(input.pages) : null, input.data],
    );
    return toMeta(row!);
  }

  async meta(activityId: string): Promise<ActivityDocumentMeta | null> {
    const row = await queryOne<MetaRow>(
      'SELECT "fileName", "mimeType", "sizeBytes", "pagesJson" FROM "ActivityDocument" WHERE "activityId" = $1',
      [activityId],
    );
    return row ? toMeta(row) : null;
  }

  async content(activityId: string): Promise<{ mimeType: DocumentMime; fileName: string; data: Buffer } | null> {
    return queryOne<{ mimeType: DocumentMime; fileName: string; data: Buffer }>(
      'SELECT "mimeType", "fileName", "data" FROM "ActivityDocument" WHERE "activityId" = $1',
      [activityId],
    );
  }

  /** Copia el documento a otra actividad (al duplicarla). */
  async copy(fromActivityId: string, toActivityId: string): Promise<void> {
    await query(
      `INSERT INTO "ActivityDocument" ("activityId", "fileName", "mimeType", "sizeBytes", "pagesJson", "data")
       SELECT $2, "fileName", "mimeType", "sizeBytes", "pagesJson", "data" FROM "ActivityDocument" WHERE "activityId" = $1
       ON CONFLICT ("activityId") DO NOTHING`,
      [fromActivityId, toActivityId],
    );
  }

  async remove(activityId: string): Promise<void> {
    await query('DELETE FROM "ActivityDocument" WHERE "activityId" = $1', [activityId]);
  }
}

export const activityDocumentRepository = new SqlActivityDocumentRepository();
