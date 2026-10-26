import { query, queryOne } from '../config/db';
import { activityRepository } from '../dal/activity.repository';
import { activityDocumentRepository } from '../dal/activity-document.repository';
import { courseRepository } from '../dal/course.repository';
import { questionRepository } from '../dal/question.repository';
import { userRepository } from '../dal/user.repository';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/http-error';
import type { CreateQuestionInput } from '../domain/activity';

export interface TemplateSummary {
  id: string;
  name: string;
  educationLevel: string;
  axis: string;
  language: string;
  authorName: string;
  questionCount: number;
  wordCount: number;
  hasDocument: boolean;
  documentFileName: string | null;
  uses: number;
  createdAt: string;
  mine: boolean;
}

export interface TemplateDetail extends Omit<TemplateSummary, 'mine'> {
  sourceText: string;
  questions: CreateQuestionInput[];
}

interface TemplateRow {
  id: string;
  institutionId: string;
  authorId: string | null;
  authorName: string;
  name: string;
  educationLevel: string;
  axis: string;
  language: string | null;
  sourceText: string;
  questionsJson: string;
  documentFileName: string | null;
  documentMimeType: string | null;
  documentPagesJson: string | null;
  hasDocument: boolean;
  uses: number;
  createdAt: Date;
}

const COLS = `"id", "institutionId", "authorId", "authorName", "name", "educationLevel", "axis", "language", "sourceText", "questionsJson",
  "documentFileName", "documentMimeType", "documentPagesJson", ("documentData" IS NOT NULL) AS "hasDocument", "uses", "createdAt"`;

function summary(r: TemplateRow, userId: string): TemplateSummary {
  return {
    id: r.id,
    name: r.name,
    educationLevel: r.educationLevel,
    axis: r.axis,
    language: r.language === 'en' ? 'en' : 'es',
    authorName: r.authorName,
    questionCount: (JSON.parse(r.questionsJson) as unknown[]).length,
    wordCount: r.sourceText.trim().split(/\s+/).filter(Boolean).length,
    hasDocument: r.hasDocument,
    documentFileName: r.documentFileName,
    uses: r.uses,
    createdAt: r.createdAt.toISOString(),
    mine: r.authorId === userId,
  };
}

export class ActivityTemplateService {
  async saveFromActivity(activityId: string, auth: { sub: string; institutionId: string }): Promise<TemplateSummary> {
    const activity = await activityRepository.findById(activityId);
    if (!activity) throw new NotFoundError('Actividad no encontrada');
    const course = await courseRepository.findById(activity.courseId);
    if (!course || course.institutionId !== auth.institutionId) throw new ForbiddenError('No tenés acceso a esa actividad');
    if (!activity.sourceText) {
      throw new ConflictError('El texto de esta actividad ya se borró al cerrarse: guardala en el banco antes de cerrarla.');
    }
    const questions = (await questionRepository.findByActivity(activityId))
      .filter((q) => q.approved)
      .map((q) => ({
        axis: q.axis,
        prompt: q.prompt,
        expectedAnswer: q.expectedAnswer,
        options: q.options ?? undefined,
        correctOption: q.correctOption ?? undefined,
        type: q.type,
        correctOptions: q.correctOptions ?? undefined,
        acceptedAnswers: q.acceptedAnswers ?? undefined,
        approved: true,
      }));
    const author = await userRepository.findById(auth.sub);
    const doc = await activityDocumentRepository.content(activityId);
    const meta = doc ? await activityDocumentRepository.meta(activityId) : null;
    const row = await queryOne<TemplateRow>(
      `INSERT INTO "ActivityTemplate"
         ("institutionId", "authorId", "authorName", "name", "educationLevel", "axis", "sourceText", "questionsJson",
          "documentFileName", "documentMimeType", "documentPagesJson", "documentData", "language")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING ${COLS}`,
      [
        auth.institutionId,
        auth.sub,
        author?.name ?? 'Docente',
        activity.name,
        activity.educationLevel,
        activity.axis,
        activity.sourceText,
        JSON.stringify(questions),
        doc?.fileName ?? null,
        doc?.mimeType ?? null,
        meta?.pages ? JSON.stringify(meta.pages) : null,
        doc?.data ?? null,
        activity.language,
      ],
    );
    return summary(row!, auth.sub);
  }

  async list(auth: { sub: string; institutionId: string }, q = ''): Promise<TemplateSummary[]> {
    const rows = await query<TemplateRow>(
      `SELECT ${COLS} FROM "ActivityTemplate"
        WHERE "institutionId" = $1 AND ($2 = '' OR "name" ILIKE '%' || $2 || '%' OR "authorName" ILIKE '%' || $2 || '%')
        ORDER BY "createdAt" DESC LIMIT 500`,
      [auth.institutionId, q.trim().slice(0, 80)],
    );
    return rows.map((r) => summary(r, auth.sub));
  }

  private async own(id: string, institutionId: string): Promise<TemplateRow> {
    const row = await queryOne<TemplateRow>(`SELECT ${COLS} FROM "ActivityTemplate" WHERE "id" = $1`, [id]);
    if (!row || row.institutionId !== institutionId) throw new NotFoundError('Actividad del banco no encontrada');
    return row;
  }

  async use(id: string, auth: { sub: string; institutionId: string }): Promise<TemplateDetail> {
    const row = await this.own(id, auth.institutionId);
    await query('UPDATE "ActivityTemplate" SET "uses" = "uses" + 1 WHERE "id" = $1', [id]);
    const { mine: _m, ...s } = summary(row, auth.sub);
    return { ...s, uses: s.uses + 1, sourceText: row.sourceText, questions: JSON.parse(row.questionsJson) as CreateQuestionInput[] };
  }

  async copyDocument(templateId: string, activityId: string, institutionId: string): Promise<boolean> {
    await this.own(templateId, institutionId);
    const existing = await activityDocumentRepository.meta(activityId);
    if (existing) return false;
    const r = await query(
      `INSERT INTO "ActivityDocument" ("activityId", "fileName", "mimeType", "sizeBytes", "pagesJson", "data")
       SELECT $2, "documentFileName", "documentMimeType", octet_length("documentData"), "documentPagesJson", "documentData"
         FROM "ActivityTemplate" WHERE "id" = $1 AND "documentData" IS NOT NULL
       RETURNING "activityId"`,
      [templateId, activityId],
    );
    return r.length > 0;
  }

  async remove(id: string, auth: { sub: string; institutionId: string; role: string }): Promise<void> {
    const row = await this.own(id, auth.institutionId);
    if (row.authorId !== auth.sub && auth.role === 'DOCENTE') throw new ForbiddenError('Sólo quien la guardó o la coordinación puede borrarla');
    await query('DELETE FROM "ActivityTemplate" WHERE "id" = $1', [id]);
  }
}

export const activityTemplateService = new ActivityTemplateService();
