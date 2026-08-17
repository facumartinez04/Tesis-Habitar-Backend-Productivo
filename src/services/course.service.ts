import { courseRepository } from '../repositories/course.repository';
import type { Course } from '../domain/course';
import type { Role } from '../domain/enums';

export interface CourseService {
  listForUser(userId: string, role: Role, institutionId: string): Promise<Course[]>;
}

export class DefaultCourseService implements CourseService {
  async listForUser(userId: string, role: Role, institutionId: string): Promise<Course[]> {
    if (role === 'DOCENTE') return courseRepository.findByTeacher(userId);
    return courseRepository.findByInstitution(institutionId);
  }
}

export const courseService = new DefaultCourseService();
