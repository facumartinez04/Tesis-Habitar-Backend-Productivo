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

  // El JWT se firma al momento del login y no se re-emite hasta que expira (7 días). Si acá
  // usáramos el "role"/"institutionId" que trae el token, un cambio de rol hecho por un admin
  // no tendría efecto hasta que ese token venza o el usuario cierre sesión manualmente. En vez
  // de confiar en el claim firmado, pisamos esos campos con el valor actual de la fila en DB en
  // cada request — el token solo sirve para identificar "quién es" (sub/provider), no "qué puede hacer".
  req.auth = { ...payload, role: user.role, institutionId: user.institutionId };
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) throw new UnauthorizedError();
    if (!roles.includes(req.auth.role)) throw new ForbiddenError('No tenés permisos para acceder a este recurso');
    next();
  };
}
