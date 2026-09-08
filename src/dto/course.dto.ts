import { z } from 'zod';

export const createCourseSchema = z.object({
  name: z.string().min(1, 'El nombre del aula o materia es obligatorio'),
  subject: z.string().min(1, 'La materia o asignatura es obligatoria'),
  grade: z.string().optional(),
  division: z.string().optional(),
  room: z.string().optional(),
  shift: z.enum(['MAÑANA', 'TARDE', 'NOCHE']).optional(),
  teacherId: z.string().optional(),
});

export type CreateCourseDto = z.infer<typeof createCourseSchema>;

export const assignCourseTeacherSchema = z.object({
  teacherId: z.string().min(1, 'El ID del docente es obligatorio'),
});
export type AssignCourseTeacherDto = z.infer<typeof assignCourseTeacherSchema>;

export const setTeacherCoursesSchema = z.object({
  courseIds: z.array(z.string()),
});
export type SetTeacherCoursesDto = z.infer<typeof setTeacherCoursesSchema>;
