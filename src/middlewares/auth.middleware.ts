import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/jwt';
import { userRepository } from '../repositories/user.repository';
import { ForbiddenError, UnauthorizedError } from '../utils/http-error';
import type { JwtPayload } from '../domain/auth';
import type { Role } from '../domain/enums';

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Falta el token de autenticación');
  }

  const token = header.slice('Bearer '.length);
  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new UnauthorizedError('Token inválido o expirado');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user || !user.active) {
    throw new UnauthorizedError('La cuenta fue desactivada');
  }

  let effectiveRole = user.role;
  let effectiveInstitutionId = user.institutionId;
  let impersonated = false;

  if (user.role === 'ADMIN') {
    const impersonateInst = req.headers['x-impersonate-institution'];
    const impersonateRole = req.headers['x-impersonate-role'];

    if (impersonateInst && typeof impersonateInst === 'string' && impersonateInst.trim()) {
      effectiveInstitutionId = impersonateInst.trim();
      impersonated = true;
    }
    if (impersonateRole && typeof impersonateRole === 'string' && impersonateRole.trim()) {
      effectiveRole = impersonateRole.trim().toUpperCase() as Role;
      impersonated = true;
    }
  }

  req.auth = {
    ...payload,
    role: effectiveRole,
    institutionId: effectiveInstitutionId,
    realRole: user.role,
    impersonated,
  };
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) throw new UnauthorizedError();

    if (req.auth.realRole === 'ADMIN' || req.auth.role === 'ADMIN') {
      return next();
    }

    const allowedRoles = roles.includes('COORDINADOR') && !roles.includes('DIRECTOR')
      ? [...roles, 'DIRECTOR' as Role]
      : roles;

    if (!allowedRoles.includes(req.auth.role)) throw new ForbiddenError('No tenés permisos para acceder a este recurso');
    next();
  };
}
