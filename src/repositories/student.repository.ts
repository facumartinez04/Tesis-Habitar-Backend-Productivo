import type { Student as PrismaStudent } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { Student } from '../domain/student';

function toDomain(record: PrismaStudent): Student {
  return {
    id: record.id,
    name: record.name,
    initials: record.initials,
    courseId: record.courseId,
  };
}

export interface StudentRepository {
  findById(id: string): Promise<Student | null>;
  findByCourse(courseId: string): Promise<Student[]>;
  searchByName(query: string): Promise<Student[]>;
  findOrCreateByName(courseId: string, name: string): Promise<Student>;
  delete(id: string): Promise<void>;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export class PrismaStudentRepository implements StudentRepository {
  async findById(id: string): Promise<Student | null> {
    const record = await prisma.student.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findByCourse(courseId: string): Promise<Student[]> {
    const records = await prisma.student.findMany({ where: { courseId } });
    return records.map(toDomain);
  }

  async searchByName(query: string): Promise<Student[]> {
    const records = await prisma.student.findMany({
      where: query ? { name: { contains: query } } : undefined,
    });
    return records.map(toDomain);
  }

  async findOrCreateByName(courseId: string, name: string): Promise<Student> {
    const trimmedName = name.trim();
    const existing = await prisma.student.findFirst({
      where: { courseId, name: { equals: trimmedName } },
    });
    if (existing) return toDomain(existing);

    const created = await prisma.student.create({
      data: { courseId, name: trimmedName, initials: initialsOf(trimmedName) },
    });
    return toDomain(created);
  }

  async delete(id: string): Promise<void> {
    await prisma.student.delete({ where: { id } });
  }
}

export const studentRepository = new PrismaStudentRepository();
