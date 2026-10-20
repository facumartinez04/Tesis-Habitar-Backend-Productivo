import { query, queryOne, withTransaction } from '../config/db';
import type { Activity, CreateActivityInput } from '../domain/activity';

interface ActivityRow {
  id: string;
  code: string;
  name: string;
  educationLevel: string;
  axis: Activity['axis'];
  sourceText: string | null;
  sourcePurgedAt: Date | null;
  diagnosticType: Activity['diagnosticType'];
  endDate: string | null;
  readingMode: Activity['readingMode'] | null;
  questionsReleasedAt: Date | null;
  readingHelp: boolean | null;
  showFeedback: boolean | null;
  availableFrom: string;
  startTime: string;
  endTime: string;
  attemptPolicy: Activity['attemptPolicy'];
  status: Activity['status'];
  qrValidUntil: string;
  courseId: string;
  createdAt: Date;
}

function generateCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const random = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  return `HAB-${random}`;
}

function toDomain(row: ActivityRow): Activity {
  return { ...row, sourcePurgedAt: row.sourcePurgedAt ?? null, diagnosticType: row.diagnosticType ?? null, endDate: row.endDate ?? null,
    readingMode: row.readingMode ?? 'LECTURA_PRIMERO', questionsReleasedAt: row.questionsReleasedAt ?? null,
    readingHelp: row.readingHelp ?? true, showFeedback: row.showFeedback ?? true };
}

export interface ActivityRepository {
  findByCode(code: string): Promise<Activity | null>;
  findById(id: string): Promise<Activity | null>;
  findByCourse(courseId: string): Promise<Activity[]>;
  create(input: CreateActivityInput): Promise<Activity>;
  countResponses(activityId: string): Promise<number>;
  updateStatus(id: string, status: Activity['status']): Promise<Activity>;
  findOpenOrScheduled(): Promise<Activity[]>;
  findOpenOrScheduledByCourse(courseId: string): Promise<Activity[]>;
  closeAndPurgeText(id: string): Promise<Activity>;
  releaseQuestions(id: string): Promise<Activity>;
  closedWithin(id: string, ms: number): Promise<boolean>;
}

export class SqlActivityRepository implements ActivityRepository {
  async findByCode(code: string): Promise<Activity | null> {
    const row = await queryOne<ActivityRow>('SELECT * FROM "Activity" WHERE "code" = $1', [code]);
    return row ? toDomain(row) : null;
  }

  async findById(id: string): Promise<Activity | null> {
    const row = await queryOne<ActivityRow>('SELECT * FROM "Activity" WHERE "id" = $1', [id]);
    return row ? toDomain(row) : null;
  }

  async findByCoursePage(
    courseId: string,
    page: { limit: number; offset: number; q: string },
  ): Promise<{ items: Activity[]; total: number }> {
    const where = `"courseId" = $1 AND ($2 = '' OR "name" ILIKE '%' || $2 || '%' OR "code" ILIKE '%' || $2 || '%')`;
    const [rows, count] = await Promise.all([
      query<ActivityRow>(`SELECT * FROM "Activity" WHERE ${where} ORDER BY "createdAt" DESC LIMIT $3 OFFSET $4`, [
        courseId,
        page.q,
        page.limit,
        page.offset,
      ]),
      queryOne<{ total: string }>(`SELECT COUNT(*) AS "total" FROM "Activity" WHERE ${where}`, [courseId, page.q]),
    ]);
    return { items: rows.map(toDomain), total: Number(count?.total ?? 0) };
  }

  async findByCourse(courseId: string): Promise<Activity[]> {
    const rows = await query<ActivityRow>(
      'SELECT * FROM "Activity" WHERE "courseId" = $1 ORDER BY "createdAt" DESC',
      [courseId],
    );
    return rows.map(toDomain);
  }

  async create(input: CreateActivityInput): Promise<Activity> {
    let code = generateCode();
    while (await this.findByCode(code)) {
      code = generateCode();
    }

    const status = input.status ?? (isFutureDate(input.availableFrom) ? 'PROGRAMADA' : 'PUBLICADA');

    return withTransaction(async (client) => {
      const { rows } = await client.query<ActivityRow>(
        `INSERT INTO "Activity"
           ("code", "name", "educationLevel", "axis", "sourceText", "availableFrom", "startTime", "endTime", "attemptPolicy", "status", "courseId", "diagnosticType", "endDate", "readingMode", "readingHelp", "showFeedback")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [
          code,
          input.name,
          input.educationLevel,
          input.axis,
          input.sourceText,
          input.availableFrom,
          input.startTime,
          input.endTime,
          input.attemptPolicy,
          status,
          input.courseId,
          input.diagnosticType ?? null,
          input.endDate && input.endDate !== input.availableFrom ? input.endDate : null,
          input.readingMode ?? 'LECTURA_PRIMERO',
          input.readingHelp ?? true,
          input.showFeedback ?? true,
        ],
      );
      const activity = rows[0];

      for (const [index, question] of input.questions.entries()) {
        await client.query(
          `INSERT INTO "Question"
             ("activityId", "axis", "prompt", "expectedAnswer", "optionsJson", "correctOption", "approved", "order", "edited")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            activity.id,
            question.axis,
            question.prompt,
            question.expectedAnswer,
            question.options ? JSON.stringify(question.options) : null,
            question.correctOption ?? null,
            question.approved,
            index,
            question.edited ?? false,
          ],
        );
      }

      return toDomain(activity);
    });
  }

  async countResponses(activityId: string): Promise<number> {
    const row = await queryOne<{ count: string }>('SELECT COUNT(*) FROM "Response" WHERE "activityId" = $1', [activityId]);
    return Number(row?.count ?? 0);
  }

  async updateStatus(id: string, status: Activity['status']): Promise<Activity> {
    const row = await queryOne<ActivityRow>('UPDATE "Activity" SET "status" = $1 WHERE "id" = $2 RETURNING *', [status, id]);
    if (!row) throw new Error(`Activity ${id} no encontrada`);
    return toDomain(row);
  }

  async findOpenOrScheduled(): Promise<Activity[]> {
    const rows = await query<ActivityRow>(`SELECT * FROM "Activity" WHERE "status" IN ('PUBLICADA', 'PROGRAMADA')`);
    return rows.map(toDomain);
  }

  async findOpenOrScheduledByCourse(courseId: string): Promise<Activity[]> {
    const rows = await query<ActivityRow>(
      `SELECT * FROM "Activity" WHERE "courseId" = $1 AND "status" IN ('PUBLICADA', 'PROGRAMADA') ORDER BY "createdAt" DESC`,
      [courseId],
    );
    return rows.map(toDomain);
  }

  async closedWithin(id: string, ms: number): Promise<boolean> {
    const row = await queryOne<{ recent: boolean }>(
      `SELECT ("sourcePurgedAt" IS NOT NULL AND "sourcePurgedAt" >= CURRENT_TIMESTAMP - ($2::int * interval '1 millisecond')) AS "recent"
         FROM "Activity" WHERE "id" = $1`,
      [id, ms],
    );
    return Boolean(row?.recent);
  }

  async releaseQuestions(id: string): Promise<Activity> {
    const row = await queryOne<ActivityRow>(
      `UPDATE "Activity" SET "questionsReleasedAt" = COALESCE("questionsReleasedAt", CURRENT_TIMESTAMP) WHERE "id" = $1 RETURNING *`,
      [id],
    );
    if (!row) throw new Error(`Activity ${id} no encontrada`);
    return toDomain(row);
  }

  async closeAndPurgeText(id: string): Promise<Activity> {
    const row = await queryOne<ActivityRow>(
      `UPDATE "Activity"
          SET "status" = 'CERRADA', "sourceText" = NULL, "sourcePurgedAt" = COALESCE("sourcePurgedAt", CURRENT_TIMESTAMP)
        WHERE "id" = $1
        RETURNING *`,
      [id],
    );
    if (!row) throw new Error(`Activity ${id} no encontrada`);
    await query('DELETE FROM "ActivityDocument" WHERE "activityId" = $1', [id]);
    return toDomain(row);
  }
}

function isFutureDate(dateStr: string): boolean {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return parsed.getTime() > todayStart.getTime();
}

export const activityRepository = new SqlActivityRepository();
