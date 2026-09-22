import { courseRepository } from '../repositories/course.repository';
import { activityRepository } from '../repositories/activity.repository';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/http-error';
import type { Course, CourseStudentDevice, CourseTeacher, CreateCourseInput } from '../domain/course';
import type { Role } from '../domain/enums';

function normalizeStudentName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export interface PublicCourseInfo {
  course: Course;
  activeActivity: {
    id: string;
    code: string;
    name: string;
    endTime: string;
  } | null;
}

export interface CourseService {
  listForUser(userId: string, role: Role, institutionId: string): Promise<Course[]>;
  getById(id: string): Promise<Course>;
  getByQrCode(qrCode: string): Promise<Course>;
  getPublicCourseByQr(qrCode: string): Promise<PublicCourseInfo>;
  create(input: CreateCourseInput): Promise<Course>;
  setActiveActivity(courseId: string, activityId: string): Promise<void>;
  assignTeacher(courseId: string, teacherId: string): Promise<Course>;
  setTeacherCourses(institutionId: string, teacherId: string, courseIds: string[]): Promise<Course[]>;
  getTeacherCourses(teacherId: string): Promise<Course[]>;
  bindStudentDevice(input: {
    courseId: string;
    studentName: string;
    deviceId: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ success: boolean; message: string; studentName: string; deviceId: string; locked: boolean }>;
  listStudentDevices(
    courseId: string,
    requester: { userId: string; role: Role; institutionId: string }
  ): Promise<CourseStudentDevice[]>;
  unlinkStudentDevice(
    courseId: string,
    deviceRecordId: string,
    requester: { userId: string; role: Role; institutionId: string }
  ): Promise<{ success: boolean; message: string }>;
}

export class DefaultCourseService implements CourseService {
  async listForUser(userId: string, role: Role, institutionId: string): Promise<Course[]> {
    if (role === 'DOCENTE') {
      const teacherCourses = await courseRepository.findByTeacher(userId);
      if (teacherCourses.length === 0 && institutionId) {
        return courseRepository.findByInstitution(institutionId);
      }
      return teacherCourses;
    }
    return courseRepository.findByInstitution(institutionId);
  }

  async getById(id: string): Promise<Course> {
    const course = await courseRepository.findById(id);
    if (!course) throw new NotFoundError('Aula no encontrada');
    return course;
  }

  async getByQrCode(qrCode: string): Promise<Course> {
    const course = await courseRepository.findByQrCode(qrCode);
    if (!course) throw new NotFoundError(`No se encontró un aula con el código QR "${qrCode}"`);
    return course;
  }

  async getPublicCourseByQr(qrCode: string): Promise<PublicCourseInfo> {
    const course = await this.getByQrCode(qrCode);
    let activeActivity: PublicCourseInfo['activeActivity'] = null;

    if (course.activeActivityId) {
      const act = await activityRepository.findById(course.activeActivityId);
      if (act) {
        activeActivity = {
          id: act.id,
          code: act.code,
          name: act.name,
          endTime: act.endTime,
        };
      }
    }

    return { course, activeActivity };
  }

  async create(input: CreateCourseInput): Promise<Course> {
    return courseRepository.create(input);
  }

  async setActiveActivity(courseId: string, activityId: string): Promise<void> {
    return courseRepository.setActiveActivity(courseId, activityId);
  }

  async assignTeacher(courseId: string, teacherId: string): Promise<Course> {
    await this.getById(courseId);
    return courseRepository.assignTeacher(courseId, teacherId);
  }

  async setTeacherCourses(institutionId: string, teacherId: string, courseIds: string[]): Promise<Course[]> {
    return courseRepository.setTeacherCourses(institutionId, teacherId, courseIds);
  }

  async getTeacherCourses(teacherId: string): Promise<Course[]> {
    return courseRepository.findByTeacher(teacherId);
  }

  async listCourseTeachers(courseId: string): Promise<CourseTeacher[]> {
    await this.getById(courseId);
    return courseRepository.listCourseTeachers(courseId);
  }

  async setCourseTeachers(courseId: string, teacherIds: string[]): Promise<CourseTeacher[]> {
    await this.getById(courseId);
    return courseRepository.setCourseTeachers(courseId, teacherIds);
  }

  async bindStudentDevice(input: {
    courseId: string;
    studentName: string;
    deviceId: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ success: boolean; message: string; studentName: string; deviceId: string; locked: boolean }> {
    const trimmedName = input.studentName?.trim();
    const cleanDeviceId = input.deviceId?.trim();

    if (!trimmedName || trimmedName.length < 2) {
      throw new BadRequestError('Ingresá tu nombre y apellido completo');
    }
    if (!cleanDeviceId) {
      throw new BadRequestError('Identificador de dispositivo no válido');
    }

    const course = await courseRepository.findById(input.courseId);
    if (!course) {
      throw new NotFoundError('Aula no encontrada');
    }

    const norm = normalizeStudentName(trimmedName);
    const existing = await courseRepository.findStudentDevice(input.courseId, norm);

    if (existing) {
      if (existing.deviceId === cleanDeviceId) {

        await courseRepository.updateDeviceLastActive(existing.id);
        return {
          success: true,
          message: 'Dispositivo verificado.',
          studentName: existing.studentName,
          deviceId: existing.deviceId,
          locked: true,
        };
      }

      throw new ConflictError(
        `Ya existe un dispositivo vinculado para "${existing.studentName}" en esta aula. Por seguridad para evitar suplantaciones, no podés registrarte desde un dispositivo diferente. Pedile a tu docente que desvincule tu dispositivo anterior.`
      );
    }

    const created = await courseRepository.bindStudentDevice({
      courseId: input.courseId,
      studentName: trimmedName,
      normalizedStudentName: norm,
      deviceId: cleanDeviceId,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });

    return {
      success: true,
      message: 'Dispositivo vinculado con éxito a esta aula.',
      studentName: created.studentName,
      deviceId: created.deviceId,
      locked: true,
    };
  }

  private async verifyTeacherPermission(
    courseId: string,
    requester: { userId: string; role: Role; institutionId: string }
  ): Promise<Course> {
    const course = await courseRepository.findById(courseId);
    if (!course) throw new NotFoundError('Aula no encontrada');

    if (requester.role === 'ADMIN') {
      return course;
    }

    if (requester.institutionId && course.institutionId !== requester.institutionId) {
      throw new ForbiddenError('No tenés acceso a aulas de otra institución');
    }

    if (requester.role === 'COORDINADOR' || requester.role === 'DIRECTOR') {
      return course;
    }

    if (requester.role === 'DOCENTE') {
      const myCourses = await courseRepository.findByTeacher(requester.userId);
      const isAssigned = myCourses.some((c) => c.id === courseId) || course.teacherId === requester.userId;
      if (!isAssigned) {
        throw new ForbiddenError('No tenés asignada esta aula para gestionar sus dispositivos');
      }
      return course;
    }

    throw new ForbiddenError('No tenés permisos para gestionar dispositivos de esta aula');
  }

  async listStudentDevices(
    courseId: string,
    requester: { userId: string; role: Role; institutionId: string }
  ): Promise<CourseStudentDevice[]> {
    await this.verifyTeacherPermission(courseId, requester);
    return courseRepository.listStudentDevices(courseId);
  }

  async unlinkStudentDevice(
    courseId: string,
    deviceRecordId: string,
    requester: { userId: string; role: Role; institutionId: string }
  ): Promise<{ success: boolean; message: string }> {
    await this.verifyTeacherPermission(courseId, requester);

    const record = await courseRepository.findDeviceById(courseId, deviceRecordId);
    if (!record) {
      throw new NotFoundError('Dispositivo vinculado no encontrado');
    }

    const unlinked = await courseRepository.unlinkStudentDevice(courseId, deviceRecordId);
    if (!unlinked) {
      throw new BadRequestError('No se pudo desvincular el dispositivo');
    }

    return {
      success: true,
      message: `Dispositivo de ${record.studentName} desvinculado con éxito. El alumno ya puede vincular un nuevo dispositivo.`,
    };
  }
}

export const courseService = new DefaultCourseService();

