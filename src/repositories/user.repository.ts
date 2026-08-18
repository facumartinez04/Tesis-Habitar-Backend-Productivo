import { query, queryOne } from '../config/db';
import type { CreateInstitutionUserInput, User } from '../domain/user';
import type { OAuthProviderId, Role } from '../domain/enums';

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

const COLUMNS = '"id", "name", "initials", "email", "role", "provider", "institutionId", "active"';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findFirstByProviderAndRole(provider: OAuthProviderId, role: Role): Promise<User | null>;
  findFirstByRole(role: Role): Promise<User | null>;
  findByInstitution(institutionId: string): Promise<User[]>;
  countActiveByInstitution(institutionId: string): Promise<number>;
  create(input: CreateInstitutionUserInput): Promise<User>;
  updateRole(id: string, role: Role): Promise<User>;
  setActive(id: string, active: boolean): Promise<User>;
}

export class SqlUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    return queryOne<User>(`SELECT ${COLUMNS} FROM "User" WHERE "id" = $1`, [id]);
  }

  async findByEmail(email: string): Promise<User | null> {
    return queryOne<User>(`SELECT ${COLUMNS} FROM "User" WHERE "email" = $1`, [email]);
  }

  async findFirstByProviderAndRole(provider: OAuthProviderId, role: Role): Promise<User | null> {
    return queryOne<User>(
      `SELECT ${COLUMNS} FROM "User" WHERE "provider" = $1 AND "role" = $2 ORDER BY "createdAt" ASC LIMIT 1`,
      [provider, role],
    );
  }

  async findFirstByRole(role: Role): Promise<User | null> {
    return queryOne<User>(`SELECT ${COLUMNS} FROM "User" WHERE "role" = $1 ORDER BY "createdAt" ASC LIMIT 1`, [role]);
  }

  async findByInstitution(institutionId: string): Promise<User[]> {
    return query<User>(`SELECT ${COLUMNS} FROM "User" WHERE "institutionId" = $1 ORDER BY "createdAt" ASC`, [institutionId]);
  }

  async countActiveByInstitution(institutionId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      'SELECT COUNT(*) FROM "User" WHERE "institutionId" = $1 AND "active" = true',
      [institutionId],
    );
    return Number(row?.count ?? 0);
  }

  async create(input: CreateInstitutionUserInput): Promise<User> {
    const row = await queryOne<User>(
      `INSERT INTO "User" ("name", "initials", "email", "role", "provider", "institutionId")
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLUMNS}`,
      [input.name, initialsOf(input.name), input.email, input.role, input.provider, input.institutionId],
    );
    return row!;
  }

  async updateRole(id: string, role: Role): Promise<User> {
    const row = await queryOne<User>(`UPDATE "User" SET "role" = $1 WHERE "id" = $2 RETURNING ${COLUMNS}`, [role, id]);
    if (!row) throw new Error(`User ${id} no encontrado`);
    return row;
  }

  async setActive(id: string, active: boolean): Promise<User> {
    const row = await queryOne<User>(`UPDATE "User" SET "active" = $1 WHERE "id" = $2 RETURNING ${COLUMNS}`, [active, id]);
    if (!row) throw new Error(`User ${id} no encontrado`);
    return row;
  }
}

export const userRepository = new SqlUserRepository();
