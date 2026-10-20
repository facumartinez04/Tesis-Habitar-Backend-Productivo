import { alertRepository } from '../dal/alert.repository';
import { courseRepository } from '../dal/course.repository';
import { institutionRepository } from '../dal/institution.repository';
import { emailService } from '../services/email.service';
import type { PerformanceAlert } from '../domain/alert';
import type { ComprehensionAxis } from '../domain/enums';

const RECENT_ACTIVITIES = 5;
const CRITICAL_GAP = 15;

const AXES: ComprehensionAxis[] = ['LITERAL', 'INFERENCIAL', 'CRITICO'];
const AXIS_LABEL: Record<ComprehensionAxis, string> = { LITERAL: 'literal', INFERENCIAL: 'inferencial', CRITICO: 'crítico' };

export interface AlertService {
  getByInstitution(institutionId: string): Promise<PerformanceAlert[]>;
  countOpen(institutionId: string): Promise<number>;
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
