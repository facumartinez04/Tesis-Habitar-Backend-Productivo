import type { NextFunction, Request, Response } from 'express';
import { verifyToken, type VerifiedToken } from '../utils/jwt';
import { revokedTokenRepository } from '../dal/revokedToken.repository';
import { userRepository } from '../dal/user.repository';
import { ForbiddenError, UnauthorizedError } from '../utils/http-error';
import type { JwtPayload } from '../domain/auth';
import type { Role } from '../domain/enums';
import { logService } from '../bll/log.service';
import { assertInstitutionActive } from '../bll/institution-pause';

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload & { jti?: string; exp?: number };
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Falta el token de autenticación');
  }

  const token = header.slice('Bearer '.length);
  let payload: VerifiedToken;
  try {
    payload = verifyToken(token);
  } catch {
    throw new UnauthorizedError('Token inválido o expirado');
  }

  if (!payload.jti || (await revokedTokenRepository.isRevoked(payload.jti))) {
    throw new UnauthorizedError('La sesión fue cerrada. Volvé a ingresar.');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user || !user.active) {
    throw new UnauthorizedError('La cuenta fue desactivada');
  }

  if (user.role !== 'ADMIN' && !req.originalUrl.startsWith('/api/auth/')) {
    await assertInstitutionActive(user.institutionId, 'staff');
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
  if (impersonated) logService.noteImpersonation(req);
  next();
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await requireAuth(req, res, () => undefined);
  } catch {
    req.auth = undefined;
  }
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

export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) throw new UnauthorizedError();
  if (req.auth.realRole !== 'ADMIN') throw new ForbiddenError('Sólo el administrador de la plataforma puede hacer esto');
  next();
}
