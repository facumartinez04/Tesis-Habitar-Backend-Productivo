import { adminDataRepository } from '../dal/admin-data.repository';
import { institutionRepository } from '../dal/institution.repository';
import { authService } from './auth.service';
import { realtime } from '../realtime/realtime';
import { NotFoundError } from '../utils/http-error';
import { pageOf, type PageRequest } from '../utils/pagination';
import { logService } from './log.service';
import type { LogActor } from '../domain/log';

const args = (page: PageRequest) => ({ limit: page.pageSize, offset: (page.page - 1) * page.pageSize, q: page.q });

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

  private record(by: LogActor, institutionId: string, entityId: string, description: string): void {
    void logService.event({ actor: by, institutionId, category: 'DATOS', type: 'BORRADO_ADMIN', entityId, description });
  }

  async deleteActivity(activityId: string, actorId: string, by: LogActor) {
    const activity = await adminDataRepository.findActivity(activityId);
    if (!activity) throw new NotFoundError('Actividad no encontrada');
    const actor = await authService.getSessionUser(actorId);
    const result = await adminDataRepository.deleteActivity(activity, { name: actor.name, id: actor.id });
    realtime.activityChanged({ ...activity, status: 'CERRADA' });
    this.record(by, activity.institutionId, activity.id, `Borró definitivamente la actividad «${activity.name}» (${activity.code}) con ${result.responses} respuestas.`);
    return result;
  }

  async deleteCourse(courseId: string, actorId: string, by: LogActor) {
    const course = await adminDataRepository.findCourse(courseId);
    if (!course) throw new NotFoundError('Aula no encontrada');
    const actor = await authService.getSessionUser(actorId);
    const result = await adminDataRepository.deleteCourse(course, { name: actor.name, id: actor.id });
    realtime.courseChanged(course.id);
    this.record(by, course.institutionId, course.id, `Borró definitivamente el aula «${course.name}»: ${result.activities} actividades, ${result.students} alumnos y ${result.responses} respuestas.`);
    return result;
  }

  async deleteStudent(studentId: string, actorId: string, by: LogActor) {
    const student = await adminDataRepository.findStudent(studentId);
    if (!student) throw new NotFoundError('Alumno no encontrado');
    const actor = await authService.getSessionUser(actorId);
    const result = await adminDataRepository.deleteStudent(student, { name: actor.name, id: actor.id });
    this.record(by, student.institutionId, student.id, `Borró definitivamente al alumno ${student.name} del aula «${student.courseName}».`);
    return result;
  }
}

export const adminDataService = new AdminDataService();
