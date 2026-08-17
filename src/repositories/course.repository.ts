import type { Course as PrismaCourse } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { Course } from '../domain/course';

function toDomain(record: PrismaCourse): Course {
  return {
    id: record.id,
    name: record.name,
    subject: record.subject,
    institutionId: record.institutionId,
    teacherId: record.teacherId,
  };
}

export interface CourseRepository {
  findById(id: string): Promise<Course | null>;
  findByTeacher(teacherId: string): Promise<Course[]>;
  findByInstitution(institutionId: string): Promise<Course[]>;
}

export class PrismaCourseRepository implements CourseRepository {
  async findById(id: string): Promise<Course | null> {
    const record = await prisma.course.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findByTeacher(teacherId: string): Promise<Course[]> {
    const records = await prisma.course.findMany({ where: { teacherId } });
    return records.map(toDomain);
  }

  async findByInstitution(institutionId: string): Promise<Course[]> {
    const records = await prisma.course.findMany({ where: { institutionId } });
    return records.map(toDomain);
  }
}

export const courseRepository = new PrismaCourseRepository();
