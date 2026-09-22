import { query, queryOne, withTransaction } from '../config/db';
import type { Activity, CreateActivityInput } from '../domain/activity';

interface ActivityRow {
  id: string;
  code: string;
  name: string;
  educationLevel: string;
  axis: Activity['axis'];
  sourceText: string;
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
  return { ...row };
}

export interface ActivityRepository {
  findByCode(code: string): Promise<Activity | null>;
  findById(id: string): Promise<Activity | null>;
  findByCourse(courseId: string): Promise<Activity[]>;
  create(input: CreateActivityInput): Promise<Activity>;
  countResponses(activityId: string): Promise<number>;
  updateStatus(id: string, status: Activity['status']): Promise<Activity>;
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
           ("code", "name", "educationLevel", "axis", "sourceText", "availableFrom", "startTime", "endTime", "attemptPolicy", "status", "courseId")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        ],
      );
      const activity = rows[0];

      for (const [index, question] of input.questions.entries()) {
        await client.query(
          `INSERT INTO "Question"
             ("activityId", "axis", "prompt", "expectedAnswer", "optionsJson", "correctOption", "approved", "order")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            activity.id,
            question.axis,
            question.prompt,
            question.expectedAnswer,
            question.options ? JSON.stringify(question.options) : null,
            question.correctOption ?? null,
            question.approved,
            index,
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
}

function isFutureDate(dateStr: string): boolean {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return parsed.getTime() > todayStart.getTime();
}

export const activityRepository = new SqlActivityRepository();
