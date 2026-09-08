import { courseRepository } from '../repositories/course.repository';
import type { Course } from '../domain/course';
import type { Role } from '../domain/enums';

export interface CourseService {
  listForUser(userId: string, role: Role, institutionId: string): Promise<Course[]>;
}

export class DefaultCourseService implements CourseService {
  async listForUser(userId: string, role: Role, institutionId: string): Promise<Course[]> {
    if (role === 'DOCENTE') {
      const teacherCourses = await courseRepository.findByTeacher(userId);
      if (teacherCourses.length === 0 && institutionId) {
        return courseRepository.findByInstitution(institutionId);
      }
      return teacherCourses;
    }
    return courseRepository.findByInstitution(institutionId);
  }
}

export const courseService = new DefaultCourseService();
