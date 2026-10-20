import type { Request, Response } from 'express';
import { logService } from '../bll/log.service';
import { NotFoundError } from '../utils/http-error';
import { readPage } from '../utils/pagination';
import type { LogKind } from '../domain/log';

const KINDS: LogKind[] = ['eventos', 'errores', 'auditoria'];

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export class LogController {
  async list(req: Request, res: Response): Promise<void> {
    const kind = String(req.params.kind) as LogKind;
    if (!KINDS.includes(kind)) throw new NotFoundError('Bitácora inexistente');
    const page = readPage(req, 25) ?? { page: 1, pageSize: 25, q: '' };
    const scope = logService.scopeOf(req);
    res.json({
      scope: scope.platformAdmin ? 'global' : 'institucion',
      ...(await logService.list(kind, scope, page, {
        institutionId: text(req.query.institutionId),
        from: text(req.query.from),
        to: text(req.query.to),
        type: text(req.query.type) ?? text(req.query.category),
      })),
    });
  }
}

export const logController = new LogController();
