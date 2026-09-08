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
}

export const courseController = new CourseController();
