import { adminDataRepository } from '../repositories/admin-data.repository';
import { institutionRepository } from '../repositories/institution.repository';
import { authService } from './auth.service';
import { realtime } from '../realtime/realtime';
import { NotFoundError } from '../utils/http-error';
import { pageOf, type PageRequest } from '../utils/pagination';

const args = (page: PageRequest) => ({ limit: page.pageSize, offset: (page.page - 1) * page.pageSize, q: page.q });

/**
 * Datos de cada institución para el administrador de la plataforma: listados paginados y borrado definitivo de
 * actividades, aulas y alumnos. Todo borrado queda en el historial con quién lo hizo y qué arrastró.
 */
export class AdminDataService {
  private async assertInstitution(institutionId: string): Promise<void> {
    if (!(await institutionRepository.findById(institutionId))) throw new NotFoundError('Institución no encontrada');
  }

  async activities(institutionId: string, page: PageRequest) {
    await this.assertInstitution(institutionId);
    const { items, total } = await adminDataRepository.listActivities(institutionId, args(page));
    return pageOf(items, total, page);
  }

  async courses(institutionId: string, page: PageRequest) {
    await this.assertInstitution(institutionId);
    const { items, total } = await adminDataRepository.listCourses(institutionId, args(page));
    return pageOf(items, total, page);
  }

  async students(institutionId: string, page: PageRequest) {
    await this.assertInstitution(institutionId);
    const { items, total } = await adminDataRepository.listStudents(institutionId, args(page));
    return pageOf(items, total, page);
  }

  async deletions(institutionId: string, page: PageRequest) {
    await this.assertInstitution(institutionId);
    const { items, total } = await adminDataRepository.listDeletions(institutionId, args(page));
    return pageOf(
      items.map(({ detailsJson, ...d }) => ({ ...d, details: JSON.parse(detailsJson || '{}') as Record<string, unknown> })),
      total,
      page,
    );
  }

  async deleteActivity(activityId: string, actorId: string) {
    const activity = await adminDataRepository.findActivity(activityId);
    if (!activity) throw new NotFoundError('Actividad no encontrada');
    const actor = await authService.getSessionUser(actorId);
    const result = await adminDataRepository.deleteActivity(activity, { name: actor.name, id: actor.id });
    // Si estaba abierta, los alumnos y el aula se enteran de que ya no está.
    realtime.activityChanged({ ...activity, status: 'CERRADA' });
    return result;
  }

  async deleteCourse(courseId: string, actorId: string) {
    const course = await adminDataRepository.findCourse(courseId);
    if (!course) throw new NotFoundError('Aula no encontrada');
    const actor = await authService.getSessionUser(actorId);
    const result = await adminDataRepository.deleteCourse(course, { name: actor.name, id: actor.id });
    realtime.courseChanged(course.id);
    return result;
  }

  async deleteStudent(studentId: string, actorId: string) {
    const student = await adminDataRepository.findStudent(studentId);
    if (!student) throw new NotFoundError('Alumno no encontrado');
    const actor = await authService.getSessionUser(actorId);
    return adminDataRepository.deleteStudent(student, { name: actor.name, id: actor.id });
  }
}

export const adminDataService = new AdminDataService();
