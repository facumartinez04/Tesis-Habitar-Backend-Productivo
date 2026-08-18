import { query, queryOne } from '../config/db';
import type { Course } from '../domain/course';

export interface CourseRepository {
  findById(id: string): Promise<Course | null>;
  findByTeacher(teacherId: string): Promise<Course[]>;
  findByInstitution(institutionId: string): Promise<Course[]>;
}

export class SqlCourseRepository implements CourseRepository {
  async findById(id: string): Promise<Course | null> {
    return queryOne<Course>('SELECT * FROM "Course" WHERE "id" = $1', [id]);
  }

  async findByTeacher(teacherId: string): Promise<Course[]> {
    return query<Course>('SELECT * FROM "Course" WHERE "teacherId" = $1', [teacherId]);
  }

  async findByInstitution(institutionId: string): Promise<Course[]> {
    return query<Course>('SELECT * FROM "Course" WHERE "institutionId" = $1', [institutionId]);
  }
}

export const courseRepository = new SqlCourseRepository();
