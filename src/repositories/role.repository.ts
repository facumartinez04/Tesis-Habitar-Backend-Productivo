import { pool } from '../config/db';
import type { RoleDefinition, RolePermission, PlatformModule, CreateRoleDto, UpdateRoleDto } from '../domain/role';
import { PLATFORM_MODULES } from '../domain/role';

export const roleRepository = {
  async findAll(): Promise<RoleDefinition[]> {
    const { rows: roleRows } = await pool.query(`
      SELECT "id", "name", "description", "isSystem", "createdAt", "updatedAt"
        FROM "RoleDefinition"
       ORDER BY "isSystem" DESC, "name" ASC
    `);

    const { rows: permRows } = await pool.query(`
      SELECT "roleId", "module", "canRead", "canCreate", "canUpdate", "canDelete", "canExport"
        FROM "RolePermission"
    `);

    const permMap = new Map<string, RolePermission[]>();
    for (const r of permRows) {
      if (!permMap.has(r.roleId)) permMap.set(r.roleId, []);
      permMap.get(r.roleId)!.push({
        module: r.module as PlatformModule,
        canRead: !!r.canRead,
        canCreate: !!r.canCreate,
        canUpdate: !!r.canUpdate,
        canDelete: !!r.canDelete,
        canExport: !!r.canExport,
      });
    }

    return roleRows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      isSystem: !!row.isSystem,
      permissions: permMap.get(row.id) || defaultModulePermissions(),
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
  },

  async findById(id: string): Promise<RoleDefinition | null> {
    const { rows: roleRows } = await pool.query(
      `SELECT "id", "name", "description", "isSystem", "createdAt", "updatedAt"
         FROM "RoleDefinition"
        WHERE "id" = $1
        LIMIT 1`,
      [id]
    );

    if (!roleRows[0]) return null;

    const { rows: permRows } = await pool.query(
      `SELECT "roleId", "module", "canRead", "canCreate", "canUpdate", "canDelete", "canExport"
         FROM "RolePermission"
        WHERE "roleId" = $1`,
      [id]
    );

    const permissions: RolePermission[] = permRows.map((r) => ({
      module: r.module as PlatformModule,
      canRead: !!r.canRead,
      canCreate: !!r.canCreate,
      canUpdate: !!r.canUpdate,
      canDelete: !!r.canDelete,
      canExport: !!r.canExport,
    }));

    return {
      id: roleRows[0].id,
      name: roleRows[0].name,
      description: roleRows[0].description || '',
      isSystem: !!roleRows[0].isSystem,
      permissions: permissions.length > 0 ? permissions : defaultModulePermissions(),
      createdAt: new Date(roleRows[0].createdAt).toISOString(),
      updatedAt: new Date(roleRows[0].updatedAt).toISOString(),
    };
  },

  async create(dto: CreateRoleDto): Promise<RoleDefinition> {
    const roleId = (dto.id || dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30)) || `role_${Date.now()}`;
    const now = new Date();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO "RoleDefinition" ("id", "name", "description", "isSystem", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, false, $4, $4)`,
        [roleId, dto.name.trim(), dto.description?.trim() || '', now]
      );

      const permissions = dto.permissions && dto.permissions.length > 0 ? dto.permissions : defaultModulePermissions();

      for (const p of permissions) {
        await client.query(
          `INSERT INTO "RolePermission" ("roleId", "module", "canRead", "canCreate", "canUpdate", "canDelete", "canExport")
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT ("roleId", "module") DO UPDATE
           SET "canRead" = EXCLUDED."canRead",
               "canCreate" = EXCLUDED."canCreate",
               "canUpdate" = EXCLUDED."canUpdate",
               "canDelete" = EXCLUDED."canDelete",
               "canExport" = EXCLUDED."canExport"`,
          [roleId, p.module, !!p.canRead, !!p.canCreate, !!p.canUpdate, !!p.canDelete, !!p.canExport]
        );
      }

      await client.query('COMMIT');

      return {
        id: roleId,
        name: dto.name.trim(),
        description: dto.description?.trim() || '',
        isSystem: false,
        permissions,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async update(id: string, dto: UpdateRoleDto): Promise<RoleDefinition | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const name = dto.name !== undefined ? dto.name.trim() : existing.name;
      const description = dto.description !== undefined ? dto.description.trim() : existing.description;
      const now = new Date();

      await client.query(
        `UPDATE "RoleDefinition"
            SET "name" = $2,
                "description" = $3,
                "updatedAt" = $4
          WHERE "id" = $1`,
        [id, name, description, now]
      );

      if (dto.permissions && Array.isArray(dto.permissions)) {
        for (const p of dto.permissions) {
          await client.query(
            `INSERT INTO "RolePermission" ("roleId", "module", "canRead", "canCreate", "canUpdate", "canDelete", "canExport")
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT ("roleId", "module") DO UPDATE
             SET "canRead" = EXCLUDED."canRead",
                 "canCreate" = EXCLUDED."canCreate",
                 "canUpdate" = EXCLUDED."canUpdate",
                 "canDelete" = EXCLUDED."canDelete",
                 "canExport" = EXCLUDED."canExport"`,
            [id, p.module, !!p.canRead, !!p.canCreate, !!p.canUpdate, !!p.canDelete, !!p.canExport]
          );
        }
      }

      await client.query('COMMIT');
      return this.findById(id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async delete(id: string): Promise<boolean> {
    const { rows } = await pool.query(`SELECT "isSystem" FROM "RoleDefinition" WHERE "id" = $1`, [id]);
    if (!rows[0] || rows[0].isSystem) return false;

    const { rowCount } = await pool.query(`DELETE FROM "RoleDefinition" WHERE "id" = $1 AND "isSystem" = false`, [id]);
    return (rowCount ?? 0) > 0;
  },
};

export function defaultModulePermissions(): RolePermission[] {
  return PLATFORM_MODULES.map((m) => ({
    module: m.id,
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canExport: false,
  }));
}
