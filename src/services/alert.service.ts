import { alertRepository } from '../repositories/alert.repository';
import { courseRepository } from '../repositories/course.repository';
import { institutionRepository } from '../repositories/institution.repository';
import { emailService } from './email.service';
import type { PerformanceAlert } from '../domain/alert';
import type { ComprehensionAxis } from '../domain/enums';

/** Actividades recientes del curso sobre las que se calcula el promedio que se compara con el umbral. */
const RECENT_ACTIVITIES = 5;
/** Más de esta cantidad de puntos debajo del umbral, la alerta es crítica. */
const CRITICAL_GAP = 15;

const AXES: ComprehensionAxis[] = ['LITERAL', 'INFERENCIAL', 'CRITICO'];
const AXIS_LABEL: Record<ComprehensionAxis, string> = { LITERAL: 'literal', INFERENCIAL: 'inferencial', CRITICO: 'crítico' };

export interface AlertService {
  getByInstitution(institutionId: string): Promise<PerformanceAlert[]>;
  countOpen(institutionId: string): Promise<number>;
  /** Compara el promedio reciente del curso con el umbral de la institución y abre, actualiza o resuelve alertas. */
  evaluateCourse(courseId: string): Promise<void>;
}

function today(): string {
  return new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
}

export class DefaultAlertService implements AlertService {
  async getByInstitution(institutionId: string): Promise<PerformanceAlert[]> {
    return alertRepository.findByInstitution(institutionId);
  }

  async countOpen(institutionId: string): Promise<number> {
    return alertRepository.countOpenByInstitution(institutionId);
  }

  async evaluateCourse(courseId: string): Promise<void> {
    const course = await courseRepository.findById(courseId);
    if (!course) return;
    const institution = await institutionRepository.findById(course.institutionId);
    if (!institution) return;

    const threshold = institution.alertThreshold;
    const [averages, open] = await Promise.all([
      alertRepository.recentCourseAverages(courseId, RECENT_ACTIVITIES),
      alertRepository.findOpenByCourse(courseId),
    ]);

    const nuevas: { axis: ComprehensionAxis; value: number; severity: 'CRITICA' | 'ADVERTENCIA' }[] = [];

    for (const axis of AXES) {
      const value = averages[axis];
      // Un eje sin datos, o pendiente de revisión docente, no abre ni resuelve alertas.
      if (value === null) continue;
      const existing = open.find((a) => a.axis === axis);

      if (value >= threshold) {
        if (existing) await alertRepository.resolve(existing.id, value);
        continue;
      }

      const severity = value < threshold - CRITICAL_GAP ? 'CRITICA' : 'ADVERTENCIA';
      const message =
        `El curso ${course.name} promedia ${value} en el eje ${AXIS_LABEL[axis]} en sus últimas actividades, ` +
        `debajo del umbral de ${threshold} de la institución.`;

      if (existing) {
        await alertRepository.update(existing.id, value, severity, message);
      } else {
        await alertRepository.open({ courseId, axis, currentValue: value, threshold, severity, detectedAt: today(), message });
        nuevas.push({ axis, value, severity });
      }
    }

    // Un solo correo por evaluación y sólo por alertas nuevas, para no generar fatiga de notificaciones
    // (CU-03-03, flujo 2.1). Si la institución desactivó los correos, la alerta igual queda registrada (2.2).
    if (nuevas.length > 0 && institution.alertEmailsEnabled && institution.coordinatorEmail) {
      const peor = nuevas.reduce((a, b) => (b.value < a.value ? b : a));
      await emailService.sendPerformanceAlertEmail({
        to: institution.coordinatorEmail,
        institutionName: institution.name,
        courseName: course.name,
        axis: peor.axis,
        currentValue: peor.value,
        threshold,
        severity: nuevas.some((n) => n.severity === 'CRITICA') ? 'CRITICA' : 'ADVERTENCIA',
      });
    }
  }
}

export const alertService = new DefaultAlertService();
