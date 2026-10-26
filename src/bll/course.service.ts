import type { Locale } from '../i18n/locale';
import { courseRepository } from '../dal/course.repository';
import { activityRepository } from '../dal/activity.repository';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/http-error';
import type { Course, CourseStudentDevice, CourseTeacher, CreateCourseInput } from '../domain/course';
import type { Role } from '../domain/enums';
import { institutionRepository } from '../dal/institution.repository';
import { resolveStudentIdentity } from './student-identity';
import { linkStudentDevice } from './student-devices';
import { assertInstitutionActive } from './institution-pause';

export interface PublicCourseInfo {
  course: Course;
  activeActivity: {
    id: string;
    code: string;
    name: string;
    endTime: string;
    endDate: string;
  } | null;
  upcomingActivity: { code: string; name: string; availableFrom: string; startTime: string } | null;
  studentIdMode: 'LISTA' | 'NOMBRE';
  language: Locale;
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
    await assertInstitutionActive(course.institutionId, 'student');
    const { activityService } = await import('./activity.service');
    const { open, upcoming } = await activityService.currentForCourse(course.id);
    const institution = await institutionRepository.findById(course.institutionId);
    return {
      course,
      activeActivity: open
        ? { id: open.id, code: open.code, name: open.name, endTime: open.endTime, endDate: open.endDate ?? open.availableFrom }
        : null,
      upcomingActivity: upcoming
        ? { code: upcoming.code, name: upcoming.name, availableFrom: upcoming.availableFrom, startTime: upcoming.startTime }
        : null,
      studentIdMode: institution?.studentIdMode ?? 'NOMBRE',
      language: institution?.defaultLanguage ?? 'es',
    };
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
    const cleanDeviceId = input.deviceId?.trim();
    if (!cleanDeviceId) {
      throw new BadRequestError('Identificador de dispositivo no válido');
    }

    const course = await courseRepository.findById(input.courseId);
    if (!course) {
      throw new NotFoundError('Aula no encontrada');
    }
    await assertInstitutionActive(course.institutionId, 'student');

    const institution = await institutionRepository.findById(course.institutionId);
    const identity = resolveStudentIdentity(institution?.studentIdMode ?? 'NOMBRE', input.studentName);
    const { device, created } = await linkStudentDevice(input.courseId, identity, cleanDeviceId, {
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });

    return {
      success: true,
      message: created ? 'Dispositivo vinculado con éxito a esta aula.' : 'Dispositivo verificado.',
      studentName: device.studentName,
      deviceId: device.deviceId,
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
      message: `Se cerró la sesión de ${record.studentName} en ese dispositivo. Ya puede ingresar desde otro.`,
    };
  }
}

export const courseService = new DefaultCourseService();

