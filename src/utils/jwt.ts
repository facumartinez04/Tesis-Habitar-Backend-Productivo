import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { JwtPayload } from '../domain/auth';

export interface VerifiedToken extends JwtPayload {
  jti: string;
  exp: number;
}

/**
 * Cada token lleva un identificador único (jti) para poder revocarlo al cerrar
 * sesión. La duración se configura con JWT_EXPIRES_IN; por defecto 12 horas, en
 * lugar de los 7 días anteriores, para acotar el daño de un token filtrado.
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    jwtid: randomUUID(),
  });
}

export function verifyToken(token: string): VerifiedToken {
  return jwt.verify(token, env.jwtSecret) as VerifiedToken;
}
