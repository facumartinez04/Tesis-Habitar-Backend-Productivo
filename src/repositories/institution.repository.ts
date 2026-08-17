import type { Institution as PrismaInstitution, InstitutionLevel } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { CreateInstitutionInput, Institution, UpdateInstitutionConfigInput } from '../domain/institution';
import type { ComprehensionAxis } from '../domain/enums';

type PrismaInstitutionWithLevels = PrismaInstitution & { levels: InstitutionLevel[] };

function parseAxes(csv: string): ComprehensionAxis[] {
  return csv
    .split(',')
    .map((axis) => axis.trim())
    .filter((axis): axis is ComprehensionAxis => axis === 'LITERAL' || axis === 'INFERENCIAL' || axis === 'CRITICO');
}

function toDomain(record: PrismaInstitutionWithLevels): Institution {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    domain: record.domain,
    status: record.status,
    coordinatorEmail: record.coordinatorEmail,
    levels: record.levels.map((l) => l.level),
    enabledAxes: parseAxes(record.enabledAxesCsv),
    aiMonthlyQuota: record.aiMonthlyQuota,
    createdAt: record.createdAt,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export interface InstitutionRepository {
  findAll(): Promise<Institution[]>;
  findById(id: string): Promise<Institution | null>;
  findBySlug(slug: string): Promise<Institution | null>;
  create(input: CreateInstitutionInput): Promise<Institution>;
  updateConfig(id: string, input: UpdateInstitutionConfigInput): Promise<Institution>;
  getAiMonthlyQuota(id: string): Promise<number>;
}

export class PrismaInstitutionRepository implements InstitutionRepository {
  async findAll(): Promise<Institution[]> {
    const records = await prisma.institution.findMany({ include: { levels: true }, orderBy: { createdAt: 'desc' } });
    return records.map(toDomain);
  }

  async findById(id: string): Promise<Institution | null> {
    const record = await prisma.institution.findUnique({ where: { id }, include: { levels: true } });
    return record ? toDomain(record) : null;
  }

  async findBySlug(slug: string): Promise<Institution | null> {
    const record = await prisma.institution.findUnique({ where: { slug }, include: { levels: true } });
    return record ? toDomain(record) : null;
  }

  async create(input: CreateInstitutionInput): Promise<Institution> {
    const baseSlug = slugify(input.name);
    const existing = await prisma.institution.count({ where: { slug: { startsWith: baseSlug } } });
    const slug = existing > 0 ? `${baseSlug}-${existing + 1}` : baseSlug;

    const record = await prisma.institution.create({
      data: {
        name: input.name,
        slug,
        domain: input.domain,
        status: input.status,
        coordinatorEmail: input.coordinatorEmail,
        levels: {
          create: input.levels.map((level) => ({ level })),
        },
      },
      include: { levels: true },
    });

    return toDomain(record);
  }

  async updateConfig(id: string, input: UpdateInstitutionConfigInput): Promise<Institution> {
    if (input.levels) {
      await prisma.institutionLevel.deleteMany({ where: { institutionId: id } });
      await prisma.institutionLevel.createMany({
        data: input.levels.map((level) => ({ institutionId: id, level })),
      });
    }

    const record = await prisma.institution.update({
      where: { id },
      data: input.enabledAxes ? { enabledAxesCsv: input.enabledAxes.join(',') } : {},
      include: { levels: true },
    });

    return toDomain(record);
  }

  async getAiMonthlyQuota(id: string): Promise<number> {
    const record = await prisma.institution.findUniqueOrThrow({ where: { id }, select: { aiMonthlyQuota: true } });
    return record.aiMonthlyQuota;
  }
}

export const institutionRepository = new PrismaInstitutionRepository();
