import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { BadRequestError } from '../utils/http-error';

/** Mensaje en español para el usuario: qué campo falta o está mal, sin el detalle técnico de zod. */
function describeIssues(issues: { path: PropertyKey[]; code: string; message: string }[]): string {
  return issues
    .map((issue) => {
      const field = issue.path.map(String).join('.') || 'datos';
      if (issue.code === 'invalid_type') return `Falta o es inválido el campo «${field}»`;
      if (issue.code === 'too_small') return `El campo «${field}» es demasiado corto o tiene pocos elementos`;
      if (issue.code === 'too_big') return `El campo «${field}» es demasiado largo o tiene demasiados elementos`;
      if (issue.code === 'invalid_value') return `El valor del campo «${field}» no es válido`;
      return `${field}: ${issue.message}`;
    })
    .join('. ');
}

export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new BadRequestError(describeIssues(result.error.issues));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      throw new BadRequestError(describeIssues(result.error.issues));
    }
    Object.assign(req.query, result.data);
    next();
  };
}
