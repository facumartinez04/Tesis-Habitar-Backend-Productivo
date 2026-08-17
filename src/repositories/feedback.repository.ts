import type { Feedback as PrismaFeedback } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { CreateFeedbackInput, Feedback } from '../domain/feedback';

type PrismaFeedbackWithAuthor = PrismaFeedback & { author: { name: string } };

function toDomain(record: PrismaFeedbackWithAuthor): Feedback {
  return {
    id: record.id,
    studentId: record.studentId,
    authorId: record.authorId,
    authorName: record.author.name,
    message: record.message,
    createdAt: record.createdAt,
  };
}

export interface FeedbackRepository {
  findByStudent(studentId: string): Promise<Feedback[]>;
  create(input: CreateFeedbackInput): Promise<Feedback>;
}

export class PrismaFeedbackRepository implements FeedbackRepository {
  async findByStudent(studentId: string): Promise<Feedback[]> {
    const records = await prisma.feedback.findMany({
      where: { studentId },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toDomain);
  }

  async create(input: CreateFeedbackInput): Promise<Feedback> {
    const record = await prisma.feedback.create({
      data: { studentId: input.studentId, authorId: input.authorId, message: input.message },
      include: { author: { select: { name: true } } },
    });
    return toDomain(record);
  }
}

export const feedbackRepository = new PrismaFeedbackRepository();
