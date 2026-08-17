import { prisma } from '../config/prisma';
import type { AxisScores } from '../domain/result';

export interface CreateResponseInput {
  activityId: string;
  studentId: string;
  studentDisplayName: string;
  answers: { questionId: string; selectedOption: string }[];
  scores: AxisScores;
}

export interface ResponseRepository {
  create(input: CreateResponseInput): Promise<{ responseId: string; resultId: string }>;
}

export class PrismaResponseRepository implements ResponseRepository {
  async create(input: CreateResponseInput): Promise<{ responseId: string; resultId: string }> {
    return prisma.$transaction(async (tx) => {
      const response = await tx.response.create({
        data: {
          activityId: input.activityId,
          studentId: input.studentId,
          studentDisplayName: input.studentDisplayName,
          answers: {
            create: input.answers.map((answer) => ({
              questionId: answer.questionId,
              selectedOption: answer.selectedOption,
            })),
          },
        },
      });

      const result = await tx.studentResult.create({
        data: {
          studentId: input.studentId,
          activityId: input.activityId,
          responseId: response.id,
          literalScore: input.scores.literal,
          inferencialScore: input.scores.inferencial,
          criticoScore: input.scores.critico,
        },
      });

      return { responseId: response.id, resultId: result.id };
    });
  }
}

export const responseRepository = new PrismaResponseRepository();
