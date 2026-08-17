import { feedbackRepository } from '../repositories/feedback.repository';
import { studentRepository } from '../repositories/student.repository';
import { NotFoundError } from '../utils/http-error';
import type { Feedback } from '../domain/feedback';

export interface FeedbackService {
  listForStudent(studentId: string): Promise<Feedback[]>;
  create(studentId: string, authorId: string, message: string): Promise<Feedback>;
}

export class DefaultFeedbackService implements FeedbackService {
  async listForStudent(studentId: string): Promise<Feedback[]> {
    return feedbackRepository.findByStudent(studentId);
  }

  async create(studentId: string, authorId: string, message: string): Promise<Feedback> {
    const student = await studentRepository.findById(studentId);
    if (!student) throw new NotFoundError('Alumno no encontrado');
    return feedbackRepository.create({ studentId, authorId, message });
  }
}

export const feedbackService = new DefaultFeedbackService();
