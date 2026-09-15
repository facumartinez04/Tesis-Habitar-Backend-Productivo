import { Router, type Request, type Response, type NextFunction } from 'express';
import { jiraController } from '../controllers/jira.controller';
import { jiraService } from '../services/jira.service';
import { UnauthorizedError } from '../utils/http-error';

export const jiraRouter = Router();

async function aiTokenOrSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    if (token.startsWith('hab_jira_')) {
      const valid = await jiraService.validateToken(token);
      if (!valid) return next(new UnauthorizedError('Token de acceso IA inválido o revocado'));
      (req as any).aiToken = valid;
      return next();
    }
  }
  next();
}

jiraRouter.use(aiTokenOrSession);

jiraRouter.get('/issues', (req, res, next) => jiraController.getAll(req, res, next));
jiraRouter.post('/issues', (req, res, next) => jiraController.create(req, res, next));
jiraRouter.get('/issues/:id', (req, res, next) => jiraController.getOne(req, res, next));
jiraRouter.patch('/issues/:id', (req, res, next) => jiraController.update(req, res, next));
jiraRouter.delete('/issues/:id', (req, res, next) => jiraController.remove(req, res, next));

jiraRouter.post('/ai/cards', (req, res, next) => jiraController.aiCreateCards(req, res, next));

jiraRouter.get('/tokens', (req, res, next) => jiraController.getTokens(req, res, next));
jiraRouter.post('/tokens', (req, res, next) => jiraController.createToken(req, res, next));
jiraRouter.delete('/tokens/:id', (req, res, next) => jiraController.deleteToken(req, res, next));
