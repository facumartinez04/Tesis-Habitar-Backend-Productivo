import { z } from 'zod';

export const generateQuestionsSchema = z.object({
  sourceText: z.string().min(10).max(20000),
  focusAxis: z.enum(['LITERAL', 'INFERENCIAL', 'CRITICO']).optional(),
  language: z.enum(['es', 'en']).optional(),
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
  availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  attemptPolicy: z.enum(['UNICO', 'REINTENTOS']),
  courseId: z.string().min(1),
  questions: z.array(questionInputSchema).min(1).max(15),
  diagnosticType: z.enum(['INICIO', 'CIERRE']).nullable().optional(),
  readingMode: z.enum(['LECTURA_PRIMERO', 'DOCENTE_HABILITA', 'LIBRE']).optional(),
  readingHelp: z.boolean().optional(),
  showFeedback: z.boolean().optional(),
  templateId: z.string().max(64).optional(),
  language: z.enum(['es', 'en']).optional(),
});

export const askHelpSchema = z.object({
  studentDisplayName: z.string().min(1).max(80),
  deviceId: z.string().min(8).max(64),
  question: z.string().min(2).max(300),
});
export type AskHelpDto = z.infer<typeof askHelpSchema>;

export const studentSessionSchema = z.object({
  studentDisplayName: z.string().min(1).max(80),
  deviceId: z.string().min(8).max(64),
});

export const saveProgressSchema = z.object({
  studentDisplayName: z.string().min(1).max(80),
  deviceId: z.string().min(8).max(64),
  phase: z.enum(['LEYENDO', 'RESPONDIENDO']),
  currentIndex: z.number().int().min(0).max(50),
  answers: z.record(z.string(), z.object({ selectedOption: z.string().max(500).optional(), textAnswer: z.string().max(4000).optional() })),
  retry: z.boolean().optional(),
});

export type StudentSessionDto = z.infer<typeof studentSessionSchema>;
export type SaveProgressDto = z.infer<typeof saveProgressSchema>;

export const editQuestionSchema = z.object({
  prompt: z.string().min(3).max(1000).optional(),
  options: z.array(z.string().min(1).max(500)).min(2).max(6).optional(),
  correctOption: z.string().min(1).max(500).optional(),
  expectedAnswer: z.string().min(1).max(2000).optional(),
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

export type EditQuestionDto = z.infer<typeof editQuestionSchema>;
