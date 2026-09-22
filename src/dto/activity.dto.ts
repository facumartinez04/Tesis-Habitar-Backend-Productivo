import { z } from 'zod';

export const generateQuestionsSchema = z.object({
  sourceText: z.string().min(10),
});

export type GenerateQuestionsDto = z.infer<typeof generateQuestionsSchema>;

const questionInputSchema = z.object({
  axis: z.enum(['LITERAL', 'INFERENCIAL', 'CRITICO']),
  prompt: z.string().min(3),
  expectedAnswer: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctOption: z.string().optional(),
  approved: z.boolean().default(true),
});

export const createActivitySchema = z.object({
  name: z.string().min(3),
  educationLevel: z.string().min(1),
  axis: z.enum(['LITERAL', 'INFERENCIAL', 'CRITICO']),
  sourceText: z.string().min(10),
  availableFrom: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  attemptPolicy: z.enum(['UNICO', 'REINTENTOS']),
  courseId: z.string().min(1),
  questions: z.array(questionInputSchema).min(1),
});

export type CreateActivityDto = z.infer<typeof createActivitySchema>;

export const submitResponseSchema = z.object({
  studentDisplayName: z.string().min(1),
  studentId: z.string().optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedOption: z.string().min(1),
      }),
    )
    .min(1),
});

export type SubmitResponseDto = z.infer<typeof submitResponseSchema>;
