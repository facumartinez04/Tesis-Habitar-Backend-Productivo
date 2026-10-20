import type { NextFunction, Request, Response } from 'express';
import { courseRepository } from '../dal/course.repository';
import { studentRepository } from '../dal/student.repository';
import { activityRepository } from '../dal/activity.repository';
import { userRepository } from '../dal/user.repository';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/http-error';

function isPlatformAdmin(req: Request): boolean {
  return req.auth?.realRole === 'ADMIN';
}

export function assertSameInstitution(req: Request, institutionId: string | null | undefined): void {
  if (!req.auth) throw new UnauthorizedError();
  if (isPlatformAdmin(req)) return;
  if (!institutionId || institutionId !== req.auth.institutionId) {
    throw new ForbiddenError('No tenés acceso a esta institución');
  }
}

function assertOwned(req: Request, institutionId: string | null | undefined, what: string): void {
  if (!req.auth) throw new UnauthorizedError();
  if (isPlatformAdmin(req)) return;
  if (!institutionId || institutionId !== req.auth.institutionId) {
    throw new NotFoundError(`${what} no encontrado`);
  }
}

export async function courseInstitutionId(courseId: string): Promise<string | null> {
  const course = await courseRepository.findById(courseId);
  return course?.institutionId ?? null;
}

export async function assertCourseAccess(req: Request, courseId: string): Promise<void> {
  assertOwned(req, await courseInstitutionId(courseId), 'Curso');
}

export async function assertStudentAccess(req: Request, studentId: string): Promise<void> {
  const student = await studentRepository.findById(studentId);
  assertOwned(req, student ? await courseInstitutionId(student.courseId) : null, 'Alumno');
}

export async function assertActivityAccess(req: Request, activityId: string): Promise<void> {
  const activity = await activityRepository.findById(activityId);
  assertOwned(req, activity ? await courseInstitutionId(activity.courseId) : null, 'Actividad');
}

export async function assertUserAccess(req: Request, userId: string): Promise<void> {
  const user = await userRepository.findById(userId);
  assertOwned(req, user?.institutionId ?? null, 'Usuario');
}

export function requireSameInstitution(param = 'institutionId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    assertSameInstitution(req, String(req.params[param] ?? ''));
    next();
  };
}

export function requireCourseAccess(param = 'courseId') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    await assertCourseAccess(req, String(req.params[param] ?? ''));
    next();
  };
}

export function requireStudentAccess(param = 'studentId') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    await assertStudentAccess(req, String(req.params[param] ?? ''));
    next();
  };
}

export function requireActivityAccess(param = 'id') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    await assertActivityAccess(req, String(req.params[param] ?? ''));
    next();
  };
}

export function requireUserAccess(param = 'userId') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    await assertUserAccess(req, String(req.params[param] ?? ''));
    next();
  };
}
