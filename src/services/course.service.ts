import { courseRepository } from '../repositories/course.repository';
import { NotFoundError } from '../utils/http-error';
import type { Course, CreateCourseInput } from '../domain/course';
import type { Role } from '../domain/enums';

export interface CourseService {
  listForUser(userId: string, role: Role, institutionId: string): Promise<Course[]>;
  getById(id: string): Promise<Course>;
  getByQrCode(qrCode: string): Promise<Course>;
  create(input: CreateCourseInput): Promise<Course>;
  setActiveActivity(courseId: string, activityId: string): Promise<void>;
  assignTeacher(courseId: string, teacherId: string): Promise<Course>;
  setTeacherCourses(institutionId: string, teacherId: string, courseIds: string[]): Promise<Course[]>;
  getTeacherCourses(teacherId: string): Promise<Course[]>;
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

  async getById(id: string): Promise<Course> {
    const course = await courseRepository.findById(id);
    if (!course) throw new NotFoundError('Aula no encontrada');
    return course;
  }

  async getByQrCode(qrCode: string): Promise<Course> {
    const course = await courseRepository.findByQrCode(qrCode);
    if (!course) throw new NotFoundError(`No se encontró un aula con el código QR "${qrCode}"`);
    return course;
  }

  async create(input: CreateCourseInput): Promise<Course> {
    return courseRepository.create(input);
  }

  async setActiveActivity(courseId: string, activityId: string): Promise<void> {
    return courseRepository.setActiveActivity(courseId, activityId);
  }

  async assignTeacher(courseId: string, teacherId: string): Promise<Course> {
    await this.getById(courseId); // Verifica que exista
    return courseRepository.assignTeacher(courseId, teacherId);
  }

  async setTeacherCourses(institutionId: string, teacherId: string, courseIds: string[]): Promise<Course[]> {
    return courseRepository.setTeacherCourses(institutionId, teacherId, courseIds);
  }

  async getTeacherCourses(teacherId: string): Promise<Course[]> {
    return courseRepository.findByTeacher(teacherId);
  }
}

export const courseService = new DefaultCourseService();
