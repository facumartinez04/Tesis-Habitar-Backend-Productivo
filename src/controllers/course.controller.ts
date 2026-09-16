import type { Request, Response } from 'express';
import { courseService } from '../services/course.service';
import type { CreateCourseDto } from '../dto/course.dto';
import { BadRequestError } from '../utils/http-error';

export class CourseController {
  async listMine(req: Request, res: Response): Promise<void> {
    const { sub, role, institutionId } = req.auth!;
    const courses = await courseService.listForUser(sub, role, institutionId);
    res.json(courses);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const course = await courseService.getById(String(req.params.id));
    res.json(course);
  }

  async getByQr(req: Request, res: Response): Promise<void> {
    const qrCode = String(req.params.qrCode);
    if (!qrCode) throw new BadRequestError('Falta el código QR del aula');
    const course = await courseService.getByQrCode(qrCode);
    res.json(course);
  }

  async create(req: Request, res: Response): Promise<void> {
    const { sub, institutionId } = req.auth!;
    const body = req.body as CreateCourseDto;

    if (!institutionId) {
      throw new BadRequestError('El usuario no tiene una institución asignada para crear el aula');
    }

    const course = await courseService.create({
      name: body.name,
      subject: body.subject,
      grade: body.grade,
      division: body.division,
      room: body.room,
      shift: body.shift,
      institutionId,
      teacherId: body.teacherId || sub,
    });

    res.status(201).json(course);
  }

  async assignTeacher(req: Request, res: Response): Promise<void> {
    const courseId = String(req.params.id);
    const { teacherId } = req.body as { teacherId: string };
    if (!teacherId) throw new BadRequestError('El ID del docente es obligatorio');

    const course = await courseService.assignTeacher(courseId, teacherId);
    res.json(course);
  }

  async listCourseTeachers(req: Request, res: Response): Promise<void> {
    const courseId = String(req.params.id);
    const teachers = await courseService.listCourseTeachers(courseId);
    res.json(teachers);
  }

  async setCourseTeachers(req: Request, res: Response): Promise<void> {
    const courseId = String(req.params.id);
    const { teacherIds } = req.body as { teacherIds: string[] };
    if (!Array.isArray(teacherIds)) throw new BadRequestError('teacherIds debe ser una lista');

    const teachers = await courseService.setCourseTeachers(courseId, teacherIds);
    res.json(teachers);
  }

  async setTeacherAssignments(req: Request, res: Response): Promise<void> {
    const teacherId = String(req.params.teacherId);
    const { courseIds } = req.body as { courseIds: string[] };
    const { institutionId } = req.auth!;

    if (!institutionId) throw new BadRequestError('No se identificó la institución del usuario');
    if (!Array.isArray(courseIds)) throw new BadRequestError('courseIds debe ser una lista de IDs de cursos');

    const courses = await courseService.setTeacherCourses(institutionId, teacherId, courseIds);
    res.json(courses);
  }

  async getTeacherAssignments(req: Request, res: Response): Promise<void> {
    const teacherId = String(req.params.teacherId);
    const courses = await courseService.getTeacherCourses(teacherId);
    res.json(courses);
  }

  async getPublicInfoByQr(req: Request, res: Response): Promise<void> {
    const qrCode = String(req.params.qrCode);
    if (!qrCode) throw new BadRequestError('Falta el código QR del aula');
    const info = await courseService.getPublicCourseByQr(qrCode);
    res.json(info);
  }

  async bindStudentDevice(req: Request, res: Response): Promise<void> {
    const courseId = String(req.params.id);
    const { studentName, deviceId } = req.body as { studentName: string; deviceId: string };
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

    const result = await courseService.bindStudentDevice({
      courseId,
      studentName,
      deviceId,
      userAgent,
      ipAddress,
    });

    res.status(201).json(result);
  }

  async listStudentDevices(req: Request, res: Response): Promise<void> {
    const courseId = String(req.params.id);
    const { sub, role, institutionId } = req.auth!;
    const devices = await courseService.listStudentDevices(courseId, {
      userId: sub,
      role,
      institutionId: institutionId || '',
    });
    res.json(devices);
  }

  async unlinkStudentDevice(req: Request, res: Response): Promise<void> {
    const courseId = String(req.params.id);
    const deviceId = String(req.params.deviceId);
    const { sub, role, institutionId } = req.auth!;

    const result = await courseService.unlinkStudentDevice(courseId, deviceId, {
      userId: sub,
      role,
      institutionId: institutionId || '',
    });

    res.json(result);
  }
}

export const courseController = new CourseController();
