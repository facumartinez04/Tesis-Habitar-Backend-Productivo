import { roleRepository } from '../repositories/role.repository';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/http-error';
import type { CreateRoleDto, PlatformModule, RoleDefinition, UpdateRoleDto } from '../domain/role';

export const roleService = {
  async getAllRoles(): Promise<RoleDefinition[]> {
    return roleRepository.findAll();
  },

  async getRoleById(id: string): Promise<RoleDefinition> {
    const role = await roleRepository.findById(id);
    if (!role) throw new NotFoundError(`El rol "${id}" no existe`);
    return role;
  },

  async createRole(dto: CreateRoleDto): Promise<RoleDefinition> {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestError('El nombre del rol es obligatorio');
    }

    const existing = dto.id ? await roleRepository.findById(dto.id) : null;
    if (existing) {
      throw new BadRequestError(`Ya existe un rol con el identificador "${dto.id}"`);
    }

    return roleRepository.create(dto);
  },

  async updateRole(id: string, dto: UpdateRoleDto): Promise<RoleDefinition> {
    const existing = await roleRepository.findById(id);
    if (!existing) throw new NotFoundError(`El rol "${id}" no existe`);

    const updated = await roleRepository.update(id, dto);
    if (!updated) throw new BadRequestError('No se pudo actualizar el rol');
    return updated;
  },

  async deleteRole(id: string): Promise<{ success: boolean }> {
    const existing = await roleRepository.findById(id);
    if (!existing) throw new NotFoundError(`El rol "${id}" no existe`);
    if (existing.isSystem) {
      throw new ForbiddenError(`No es posible eliminar el rol del sistema "${existing.name}"`);
    }

    const deleted = await roleRepository.delete(id);
    if (!deleted) throw new BadRequestError('No se pudo eliminar el rol');
    return { success: true };
  },

  async checkPermission(
    roleId: string,
    module: PlatformModule,
    action: 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete' | 'canExport'
  ): Promise<boolean> {

    if (roleId === 'admin') return true;

    const role = await roleRepository.findById(roleId);
    if (!role) return false;

    const perm = role.permissions.find((p) => p.module === module);
    return perm ? perm[action] : false;
  },
};
