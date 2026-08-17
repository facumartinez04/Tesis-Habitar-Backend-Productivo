import type { Activity as PrismaActivity } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { Activity, CreateActivityInput } from '../domain/activity';

function generateCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const random = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  return `HAB-${random}`;
}

function toDomain(record: PrismaActivity): Activity {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    educationLevel: record.educationLevel,
    axis: record.axis,
    sourceText: record.sourceText,
    availableFrom: record.availableFrom,
    startTime: record.startTime,
    endTime: record.endTime,
    attemptPolicy: record.attemptPolicy,
    status: record.status,
    qrValidUntil: record.qrValidUntil,
    courseId: record.courseId,
    createdAt: record.createdAt,
  };
}

export interface ActivityRepository {
  findByCode(code: string): Promise<Activity | null>;
  findById(id: string): Promise<Activity | null>;
  findByCourse(courseId: string): Promise<Activity[]>;
  create(input: CreateActivityInput): Promise<Activity>;
  countResponses(activityId: string): Promise<number>;
  updateStatus(id: string, status: Activity['status']): Promise<Activity>;
}

export class PrismaActivityRepository implements ActivityRepository {
  async findByCode(code: string): Promise<Activity | null> {
    const record = await prisma.activity.findUnique({ where: { code } });
    return record ? toDomain(record) : null;
  }

  async findById(id: string): Promise<Activity | null> {
    const record = await prisma.activity.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findByCourse(courseId: string): Promise<Activity[]> {
    const records = await prisma.activity.findMany({ where: { courseId }, orderBy: { createdAt: 'desc' } });
    return records.map(toDomain);
  }

  async create(input: CreateActivityInput): Promise<Activity> {
    let code = generateCode();
    while (await prisma.activity.findUnique({ where: { code } })) {
      code = generateCode();
    }

    const status = input.status ?? (isFutureDate(input.availableFrom) ? 'PROGRAMADA' : 'PUBLICADA');

    const record = await prisma.activity.create({
      data: {
        code,
        name: input.name,
        educationLevel: input.educationLevel,
        axis: input.axis,
        sourceText: input.sourceText,
        availableFrom: input.availableFrom,
        startTime: input.startTime,
        endTime: input.endTime,
        attemptPolicy: input.attemptPolicy,
        status,
        courseId: input.courseId,
        questions: {
          create: input.questions.map((question, index) => ({
            axis: question.axis,
            prompt: question.prompt,
            expectedAnswer: question.expectedAnswer,
            optionsJson: question.options ? JSON.stringify(question.options) : null,
            correctOption: question.correctOption ?? null,
            approved: question.approved,
            order: index,
          })),
        },
      },
    });

    return toDomain(record);
  }

  async countResponses(activityId: string): Promise<number> {
    return prisma.response.count({ where: { activityId } });
  }

  async updateStatus(id: string, status: Activity['status']): Promise<Activity> {
    const record = await prisma.activity.update({ where: { id }, data: { status } });
    return toDomain(record);
  }
}

function isFutureDate(dateStr: string): boolean {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return parsed.getTime() > todayStart.getTime();
}

export const activityRepository = new PrismaActivityRepository();
