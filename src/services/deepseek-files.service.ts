import { UpstreamError } from '../utils/http-error';

/**
 * API de archivos de DeepSeek (https://api-docs.deepseek.com/guides/files_api).
 * Un documento se sube, DeepSeek lo analiza y devuelve un file_id que se referencia en el chat.
 */

/** Dirección de /files a partir de la del chat (…/chat/completions). */
export function filesUrlFor(chatApiUrl: string): string {
  return `${new URL(chatApiUrl).origin}/files`;
}

const UPLOAD_TIMEOUT_MS = 180_000;
const DELETE_TIMEOUT_MS = 20_000;

/**
 * Sube un PDF con «rich_layout_recognition»: el modelo recibe el texto y también las figuras (diapositivas, esquemas).
 * El archivo vence solo a la hora como red de seguridad, por si no se llega a borrar.
 * `purpose` va antes que `file`: si no, DeepSeek responde 400.
 */
export async function uploadDeepseekPdf(input: { apiKey: string; chatApiUrl: string; data: Buffer; fileName?: string }): Promise<string> {
  const form = new FormData();
  form.append('purpose', 'rich_layout_recognition');
  form.append('expires_after[anchor]', 'created_at');
  form.append('expires_after[seconds]', '3600');
  form.append('file', new Blob([new Uint8Array(input.data)], { type: 'application/pdf' }), input.fileName ?? 'lectura.pdf');

  let res: Response;
  try {
    res = await fetch(filesUrlFor(input.chatApiUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.apiKey.trim()}` },
      body: form,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
  } catch (err) {
    throw new UpstreamError(`No se pudo subir el documento a DeepSeek: ${(err as Error).message}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new UpstreamError(`DeepSeek rechazó el documento (${res.status}): ${body.slice(0, 250)}`);
  }
  const payload = (await res.json().catch(() => null)) as { id?: string } | null;
  if (!payload?.id) throw new UpstreamError('DeepSeek no devolvió el identificador del documento');
  return payload.id;
}

/** Borra el archivo de DeepSeek. Si falla no corta nada: el archivo vence solo a la hora de subirse. */
export async function deleteDeepseekFile(input: { apiKey: string; chatApiUrl: string; fileId: string }): Promise<void> {
  try {
    const res = await fetch(`${filesUrlFor(input.chatApiUrl)}/${encodeURIComponent(input.fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${input.apiKey.trim()}` },
      signal: AbortSignal.timeout(DELETE_TIMEOUT_MS),
    });
    if (!res.ok) console.error(`[deepseek-files] No se pudo borrar el archivo ${input.fileId} (${res.status}); vence solo en una hora.`);
  } catch (err) {
    console.error(`[deepseek-files] No se pudo borrar el archivo ${input.fileId}:`, (err as Error).message);
  }
}
