import { courseRepository } from '../dal/course.repository';
import { ConflictError } from '../utils/http-error';
import type { CourseStudentDevice } from '../domain/course';
import type { StudentIdentity } from './student-identity';

export const MAX_DEVICES_PER_STUDENT = 2;

export type DeviceLink = { device: CourseStudentDevice; created: boolean };

export class TooManyDevicesError extends ConflictError {
  constructor(displayName: string) {
    super(
      `${displayName} ya tiene su cuenta abierta en ${MAX_DEVICES_PER_STUDENT} dispositivos. Pedile a tu docente que cierre la sesión en uno de ellos.`,
    );
  }
}

export async function linkStudentDevice(
  courseId: string,
  identity: StudentIdentity,
  deviceId: string,
  meta: { userAgent?: string; ipAddress?: string } = {},
): Promise<DeviceLink> {
  const devices = await courseRepository.listStudentDevicesFor(courseId, identity.normalized);
  const existing = devices.find((d) => d.deviceId === deviceId);
  if (existing) {
    await courseRepository.updateDeviceLastActive(existing.id);
    return { device: existing, created: false };
  }
  if (devices.length >= MAX_DEVICES_PER_STUDENT) throw new TooManyDevicesError(devices[0]?.studentName ?? identity.displayName);

  const device = await courseRepository.bindStudentDevice({
    courseId,
    studentName: devices[0]?.studentName ?? identity.displayName,
    normalizedStudentName: identity.normalized,
    deviceId,
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });
  return { device, created: true };
}
