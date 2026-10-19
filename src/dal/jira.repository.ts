import { pool } from '../config/db';
import type { JiraIssue, JiraToken } from '../domain/jira';

export const jiraRepository = {
  async findAll(): Promise<JiraIssue[]> {
    const { rows } = await pool.query(`
      SELECT "id", "title", "description", "type", "priority", "status", "assignee",
             "tags", to_char("dueDate", 'YYYY-MM-DD') as "dueDate", "storyPoints",
             "checklist", "comments", "createdAt", "updatedAt"
        FROM "JiraIssue"
       ORDER BY "createdAt" DESC
    `);
    return rows.map(mapRowToIssue);
  },

  async findById(id: string): Promise<JiraIssue | null> {
    const { rows } = await pool.query(
      `SELECT "id", "title", "description", "type", "priority", "status", "assignee",
              "tags", to_char("dueDate", 'YYYY-MM-DD') as "dueDate", "storyPoints",
              "checklist", "comments", "createdAt", "updatedAt"
         FROM "JiraIssue"
        WHERE "id" = $1
        LIMIT 1`,
      [id]
    );
    return rows[0] ? mapRowToIssue(rows[0]) : null;
  },

  async getNextIdNumber(): Promise<number> {
    const { rows } = await pool.query(`SELECT "id" FROM "JiraIssue" WHERE "id" ~ '^HAB-[0-9]+$'`);
    let max = 0;
    for (const r of rows) {
      const match = r.id.match(/^HAB-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
    return max + 1;
  },

  async create(issue: JiraIssue): Promise<JiraIssue> {
    const { rows } = await pool.query(
      `INSERT INTO "JiraIssue" (
         "id", "title", "description", "type", "priority", "status", "assignee",
         "tags", "dueDate", "storyPoints", "checklist", "comments", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
       RETURNING "id", "title", "description", "type", "priority", "status", "assignee",
                 "tags", to_char("dueDate", 'YYYY-MM-DD') as "dueDate", "storyPoints",
                 "checklist", "comments", "createdAt", "updatedAt"`,
      [
        issue.id,
        issue.title,
        issue.description || '',
        issue.type,
        issue.priority,
        issue.status,
        JSON.stringify(issue.assignee),
        JSON.stringify(issue.tags || []),
        issue.dueDate || null,
        issue.storyPoints ?? null,
        JSON.stringify(issue.checklist || []),
        JSON.stringify(issue.comments || []),
      ]
    );
    return mapRowToIssue(rows[0]);
  },

  async update(id: string, fields: Partial<JiraIssue>): Promise<JiraIssue | null> {
    const current = await this.findById(id);
    if (!current) return null;

    const updated = {
      title: fields.title ?? current.title,
      description: fields.description ?? current.description,
      type: fields.type ?? current.type,
      priority: fields.priority ?? current.priority,
      status: fields.status ?? current.status,
      assignee: fields.assignee ?? current.assignee,
      tags: fields.tags ?? current.tags,
      dueDate: fields.dueDate !== undefined ? fields.dueDate : current.dueDate,
      storyPoints: fields.storyPoints !== undefined ? fields.storyPoints : current.storyPoints,
      checklist: fields.checklist ?? current.checklist,
      comments: fields.comments ?? current.comments,
    };

    const { rows } = await pool.query(
      `UPDATE "JiraIssue"
          SET "title" = $2,
              "description" = $3,
              "type" = $4,
              "priority" = $5,
              "status" = $6,
              "assignee" = $7,
              "tags" = $8,
              "dueDate" = $9,
              "storyPoints" = $10,
              "checklist" = $11,
              "comments" = $12,
              "updatedAt" = now()
        WHERE "id" = $1
        RETURNING "id", "title", "description", "type", "priority", "status", "assignee",
                  "tags", to_char("dueDate", 'YYYY-MM-DD') as "dueDate", "storyPoints",
                  "checklist", "comments", "createdAt", "updatedAt"`,
      [
        id,
        updated.title,
        updated.description,
        updated.type,
        updated.priority,
        updated.status,
        JSON.stringify(updated.assignee),
        JSON.stringify(updated.tags),
        updated.dueDate || null,
        updated.storyPoints ?? null,
        JSON.stringify(updated.checklist),
        JSON.stringify(updated.comments),
      ]
    );

    return rows[0] ? mapRowToIssue(rows[0]) : null;
  },

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await pool.query(`DELETE FROM "JiraIssue" WHERE "id" = $1`, [id]);
    return (rowCount ?? 0) > 0;
  },

  async count(): Promise<number> {
    const { rows } = await pool.query(`SELECT COUNT(*)::int as total FROM "JiraIssue"`);
    return rows[0].total;
  },

  async clearAll(): Promise<void> {
    await pool.query(`DELETE FROM "JiraIssue"`);
  },

  async createToken(params: { name: string; token: string; prefix: string }): Promise<JiraToken> {
    const { rows } = await pool.query(
      `INSERT INTO "JiraToken" ("name", "token", "prefix", "createdAt")
       VALUES ($1, $2, $3, now())
       RETURNING "id", "name", "token", "prefix", "createdAt", "lastUsedAt"`,
      [params.name, params.token, params.prefix]
    );
    return mapRowToToken(rows[0]);
  },

  async listTokens(): Promise<JiraToken[]> {
    const { rows } = await pool.query(`
      SELECT "id", "name", "token", "prefix", "createdAt", "lastUsedAt"
        FROM "JiraToken"
       ORDER BY "createdAt" DESC
    `);
    return rows.map(mapRowToToken);
  },

  async findToken(token: string): Promise<JiraToken | null> {
    const { rows } = await pool.query(
      `SELECT "id", "name", "token", "prefix", "createdAt", "lastUsedAt"
         FROM "JiraToken"
        WHERE "token" = $1
        LIMIT 1`,
      [token]
    );
    return rows[0] ? mapRowToToken(rows[0]) : null;
  },

  async touchToken(token: string): Promise<void> {
    await pool.query(`UPDATE "JiraToken" SET "lastUsedAt" = now() WHERE "token" = $1`, [token]);
  },

  async deleteToken(id: string): Promise<boolean> {
    const { rowCount } = await pool.query(`DELETE FROM "JiraToken" WHERE "id" = $1`, [id]);
    return (rowCount ?? 0) > 0;
  },
};

function mapRowToIssue(row: any): JiraIssue {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    type: row.type,
    priority: row.priority,
    status: row.status,
    assignee: typeof row.assignee === 'string' ? JSON.parse(row.assignee) : row.assignee,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [],
    dueDate: row.dueDate || undefined,
    storyPoints: row.storyPoints ?? undefined,
    checklist: typeof row.checklist === 'string' ? JSON.parse(row.checklist) : row.checklist || [],
    comments: typeof row.comments === 'string' ? JSON.parse(row.comments) : row.comments || [],
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
  };
}

function mapRowToToken(row: any): JiraToken {
  return {
    id: row.id,
    name: row.name,
    token: row.token,
    prefix: row.prefix,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : undefined,
  };
}
