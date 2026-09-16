import type { Request, Response, NextFunction } from 'express';
import { jiraService } from '../services/jira.service';

export class JiraController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const issues = await jiraService.getAllIssues();
      res.json({ issues });
    } catch (err) {
      next(err);
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const issue = await jiraService.getIssueById(String(req.params.id));
      res.json({ issue });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const issue = await jiraService.createIssue(req.body);
      res.status(201).json({ issue });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const issue = await jiraService.updateIssue(String(req.params.id), req.body);
      res.json({ issue });
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await jiraService.deleteIssue(String(req.params.id));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }

  async createToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = await jiraService.generateToken(req.body.name);
      res.status(201).json({ token });
    } catch (err) {
      next(err);
    }
  }

  async getTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tokens = await jiraService.listTokens();
      res.json({ tokens });
    } catch (err) {
      next(err);
    }
  }

  async deleteToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await jiraService.revokeToken(String(req.params.id));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }

  async aiCreateCards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const createdCards = await jiraService.createAiBatchCards(req.body.cards);
      res.status(201).json({
        success: true,
        count: createdCards.length,
        cards: createdCards,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const jiraController = new JiraController();
