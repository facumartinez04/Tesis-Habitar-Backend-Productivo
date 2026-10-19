import { Router, type Request, type Response, type NextFunction } from 'express';
import { jiraController } from '../controllers/jira.controller';
import { jiraService } from '../bll/jira.service';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { UnauthorizedError } from '../utils/http-error';

export const jiraRouter = Router();

const AI_TOKEN_PREFIX = 'hab_jira_';

/**
 * Las tarjetas aceptan dos credenciales: un token de IA válido (para agentes
 * externos) o una sesión de administrador. Antes, un pedido sin credenciales
 * también pasaba.
 */
async function aiTokenOrAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';

  if (token.startsWith(AI_TOKEN_PREFIX)) {
    const valid = await jiraService.validateToken(token);
    if (!valid) throw new UnauthorizedError('Token de acceso IA inválido o revocado');
    (req as Request & { aiToken?: unknown }).aiToken = valid;
    next();
    return;
  }

  await requireAuth(req, res, () => undefined);
  requireRole('ADMIN')(req, res, next);
}

jiraRouter.get('/issues', aiTokenOrAdmin, (req, res, next) => jiraController.getAll(req, res, next));
jiraRouter.post('/issues', aiTokenOrAdmin, (req, res, next) => jiraController.create(req, res, next));
jiraRouter.get('/issues/:id', aiTokenOrAdmin, (req, res, next) => jiraController.getOne(req, res, next));
jiraRouter.patch('/issues/:id', aiTokenOrAdmin, (req, res, next) => jiraController.update(req, res, next));
jiraRouter.delete('/issues/:id', aiTokenOrAdmin, (req, res, next) => jiraController.remove(req, res, next));
jiraRouter.post('/ai/cards', aiTokenOrAdmin, (req, res, next) => jiraController.aiCreateCards(req, res, next));

// Administrar tokens exige una sesión de administrador: un token de IA no puede
// crear ni listar otros tokens.
jiraRouter.get('/tokens', requireAuth, requireRole('ADMIN'), (req, res, next) => jiraController.getTokens(req, res, next));
jiraRouter.post('/tokens', requireAuth, requireRole('ADMIN'), (req, res, next) => jiraController.createToken(req, res, next));
jiraRouter.delete('/tokens/:id', requireAuth, requireRole('ADMIN'), (req, res, next) => jiraController.deleteToken(req, res, next));
