import type { Question as PrismaQuestion } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { Question } from '../domain/question';

function toDomain(record: PrismaQuestion): Question {
  return {
    id: record.id,
    activityId: record.activityId,
    axis: record.axis,
    prompt: record.prompt,
    expectedAnswer: record.expectedAnswer,
    options: record.optionsJson ? JSON.parse(record.optionsJson) : null,
    correctOption: record.correctOption,
    edited: record.edited,
    approved: record.approved,
    order: record.order,
  };
}

export interface QuestionRepository {
  findByActivity(activityId: string): Promise<Question[]>;
  findByIds(ids: string[]): Promise<Question[]>;
}

export class PrismaQuestionRepository implements QuestionRepository {
  async findByActivity(activityId: string): Promise<Question[]> {
    const records = await prisma.question.findMany({ where: { activityId }, orderBy: { order: 'asc' } });
    return records.map(toDomain);
  }

  async findByIds(ids: string[]): Promise<Question[]> {
    const records = await prisma.question.findMany({ where: { id: { in: ids } } });
    return records.map(toDomain);
  }
}

export const questionRepository = new PrismaQuestionRepository();
