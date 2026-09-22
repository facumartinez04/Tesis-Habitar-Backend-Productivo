import crypto from 'node:crypto';
import { jiraRepository } from '../repositories/jira.repository';
import { BadRequestError, NotFoundError } from '../utils/http-error';
import type { JiraIssue, JiraToken } from '../domain/jira';

export const jiraService = {
  async getAllIssues(): Promise<JiraIssue[]> {
    return jiraRepository.findAll();
  },

  async getIssueById(id: string): Promise<JiraIssue> {
    const issue = await jiraRepository.findById(id);
    if (!issue) throw new NotFoundError('Incidencia no encontrada');
    return issue;
  },

  async createIssue(payload: any): Promise<JiraIssue> {
    if (!payload.title || !String(payload.title).trim()) {
      throw new BadRequestError('El título es requerido');
    }

    const nextNum = await jiraRepository.getNextIdNumber();
    const id = `HAB-${String(nextNum).padStart(2, '0')}`;
    const now = new Date().toISOString();

    const newIssue: JiraIssue = {
      id,
      title: String(payload.title).trim(),
      description: payload.description ? String(payload.description).trim() : '',
      type: payload.type || 'task',
      priority: payload.priority || 'medium',
      status: payload.status || 'todo',
      assignee: payload.assignee || {
        id: 'usr-1',
        name: payload.assigneeName || 'Facundo (Admin)',
        email: 'facumarti06@gmail.com',
        initials: 'FA',
        color: 'bg-teal-700',
      },
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      dueDate: payload.dueDate || undefined,
      storyPoints: payload.storyPoints ? Number(payload.storyPoints) : undefined,
      checklist: Array.isArray(payload.checklist)
        ? payload.checklist.map((item: any, idx: number) =>
            typeof item === 'string'
              ? { id: `chk-${Date.now()}-${idx}`, text: item.trim(), done: false }
              : item
          )
        : [],
      comments: [],
      createdAt: now,
      updatedAt: now,
    };

    return jiraRepository.create(newIssue);
  },

  async updateIssue(id: string, updates: Partial<JiraIssue>): Promise<JiraIssue> {
    const updated = await jiraRepository.update(id, updates);
    if (!updated) throw new NotFoundError('Incidencia no encontrada');
    return updated;
  },

  async deleteIssue(id: string): Promise<{ success: boolean }> {
    const deleted = await jiraRepository.delete(id);
    if (!deleted) throw new NotFoundError('Incidencia no encontrada');
    return { success: true };
  },

  async generateToken(name = 'AI Jira Agent'): Promise<JiraToken> {
    const randomHex = crypto.randomBytes(24).toString('hex');
    const prefix = 'hab_jira_';
    const token = `${prefix}${randomHex}`;

    return jiraRepository.createToken({
      name: name.trim() || 'AI Jira Agent',
      token,
      prefix,
    });
  },

  async listTokens(): Promise<JiraToken[]> {
    return jiraRepository.listTokens();
  },

  async revokeToken(id: string): Promise<{ success: boolean }> {
    const deleted = await jiraRepository.deleteToken(id);
    if (!deleted) throw new NotFoundError('Token no encontrado');
    return { success: true };
  },

  async validateToken(tokenString?: string): Promise<JiraToken | null> {
    if (!tokenString) return null;
    const token = await jiraRepository.findToken(tokenString);
    if (!token) return null;
    await jiraRepository.touchToken(tokenString);
    return token;
  },

  async createAiBatchCards(cards: any[]): Promise<JiraIssue[]> {
    if (!Array.isArray(cards) || cards.length === 0) {
      throw new BadRequestError('Debe proporcionar una lista de tarjetas en el campo "cards"');
    }

    const createdList: JiraIssue[] = [];
    for (const card of cards) {
      const created = await this.createIssue({
        title: card.title,
        description: card.description || '',
        type: card.type || 'task',
        priority: card.priority || 'medium',
        status: card.status || 'todo',
        tags: Array.isArray(card.tags) ? card.tags : ['AI-Generated'],
        dueDate: card.dueDate,
        storyPoints: card.storyPoints,
        checklist: card.checklist,
        assigneeName: card.assigneeName || 'Facundo (Admin)',
      });
      createdList.push(created);
    }
    return createdList;
  },
};
