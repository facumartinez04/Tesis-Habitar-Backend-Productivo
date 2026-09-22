import { z } from 'zod';

export const createFeedbackSchema = z.object({
  message: z.string().min(3).max(2000),
});

export type CreateFeedbackDto = z.infer<typeof createFeedbackSchema>;
