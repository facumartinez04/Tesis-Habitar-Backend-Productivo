import { query, queryOne } from '../config/db';
import type { Student } from '../domain/student';

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

export class SqlStudentRepository implements StudentRepository {
  async findById(id: string): Promise<Student | null> {
    return queryOne<Student>('SELECT "id", "name", "initials", "courseId" FROM "Student" WHERE "id" = $1', [id]);
  }

  async findByCourse(courseId: string): Promise<Student[]> {
    return query<Student>('SELECT "id", "name", "initials", "courseId" FROM "Student" WHERE "courseId" = $1', [courseId]);
  }

  async searchByName(search: string): Promise<Student[]> {
    if (!search) return query<Student>('SELECT "id", "name", "initials", "courseId" FROM "Student"');
    return query<Student>('SELECT "id", "name", "initials", "courseId" FROM "Student" WHERE "name" LIKE $1', [`%${search}%`]);
  }

  async findOrCreateByName(courseId: string, name: string): Promise<Student> {
    const trimmedName = name.trim();
    const existing = await queryOne<Student>(
      'SELECT "id", "name", "initials", "courseId" FROM "Student" WHERE "courseId" = $1 AND "name" = $2',
      [courseId, trimmedName],
    );
    if (existing) return existing;

    const created = await queryOne<Student>(
      `INSERT INTO "Student" ("courseId", "name", "initials") VALUES ($1, $2, $3)
       RETURNING "id", "name", "initials", "courseId"`,
      [courseId, trimmedName, initialsOf(trimmedName)],
    );
    return created!;
  }

  async delete(id: string): Promise<void> {
    await query('DELETE FROM "Student" WHERE "id" = $1', [id]);
  }
}

export const studentRepository = new SqlStudentRepository();
