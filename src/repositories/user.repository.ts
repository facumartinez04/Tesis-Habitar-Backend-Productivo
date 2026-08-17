import type { User as PrismaUser } from '@prisma/client';
import { prisma } from '../config/prisma';
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

function toDomain(record: PrismaUser): User {
  return {
    id: record.id,
    name: record.name,
    initials: record.initials,
    email: record.email,
    role: record.role,
    provider: record.provider,
    institutionId: record.institutionId,
    active: record.active,
  };
}

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

export class PrismaUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const record = await prisma.user.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await prisma.user.findUnique({ where: { email } });
    return record ? toDomain(record) : null;
  }

  async findFirstByProviderAndRole(provider: OAuthProviderId, role: Role): Promise<User | null> {
    const record = await prisma.user.findFirst({ where: { provider, role }, orderBy: { createdAt: 'asc' } });
    return record ? toDomain(record) : null;
  }

  async findFirstByRole(role: Role): Promise<User | null> {
    const record = await prisma.user.findFirst({ where: { role }, orderBy: { createdAt: 'asc' } });
    return record ? toDomain(record) : null;
  }

  async findByInstitution(institutionId: string): Promise<User[]> {
    const records = await prisma.user.findMany({ where: { institutionId }, orderBy: { createdAt: 'asc' } });
    return records.map(toDomain);
  }

  async countActiveByInstitution(institutionId: string): Promise<number> {
    return prisma.user.count({ where: { institutionId, active: true } });
  }

  async create(input: CreateInstitutionUserInput): Promise<User> {
    const record = await prisma.user.create({
      data: {
        name: input.name,
        initials: initialsOf(input.name),
        email: input.email,
        role: input.role,
        provider: input.provider,
        institutionId: input.institutionId,
      },
    });
    return toDomain(record);
  }

  async updateRole(id: string, role: Role): Promise<User> {
    const record = await prisma.user.update({ where: { id }, data: { role } });
    return toDomain(record);
  }

  async setActive(id: string, active: boolean): Promise<User> {
    const record = await prisma.user.update({ where: { id }, data: { active } });
    return toDomain(record);
  }
}

export const userRepository = new PrismaUserRepository();
