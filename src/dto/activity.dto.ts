import { z } from 'zod';

export const generateQuestionsSchema = z.object({
  sourceText: z.string().min(10).max(20000),
  /** Eje foco: la mezcla de preguntas se carga hacia ese eje (mejora 2). */
  focusAxis: z.enum(['LITERAL', 'INFERENCIAL', 'CRITICO']).optional(),
});

export type GenerateQuestionsDto = z.infer<typeof generateQuestionsSchema>;

const questionInputSchema = z.object({
  axis: z.enum(['LITERAL', 'INFERENCIAL', 'CRITICO']),
  prompt: z.string().min(3),
  expectedAnswer: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctOption: z.string().optional(),
  approved: z.boolean().default(true),
  edited: z.boolean().optional(),
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
  questions: z.array(questionInputSchema).min(1).max(15),
  diagnosticType: z.enum(['INICIO', 'CIERRE']).nullable().optional(),
});

export type CreateActivityDto = z.infer<typeof createActivitySchema>;

export const submitResponseSchema = z.object({
  studentDisplayName: z.string().min(1).max(80),
  deviceId: z.string().min(8).max(64),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedOption: z.string().min(1).optional(),
        textAnswer: z.string().max(4000).optional(),
      }),
    )
    .max(30),
});

export const reviewAnswerSchema = z.object({
  score: z.number().int().min(0).max(3),
});

export type ReviewAnswerDto = z.infer<typeof reviewAnswerSchema>;

export type SubmitResponseDto = z.infer<typeof submitResponseSchema>;
