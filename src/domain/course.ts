export interface Course {
  id: string;
  name: string;
  subject: string;
  institutionId: string;
  teacherId: string;
  qrCode: string;
  room?: string;
  grade?: string;
  division?: string;
  shift?: string;
  activeActivityId?: string | null;
  institutionName?: string;
  teacherName?: string;
  studentsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCourseInput {
  name: string;
  subject: string;
  grade?: string;
  division?: string;
  room?: string;
  shift?: string;
  institutionId: string;
  teacherId: string;
  qrCode?: string;
}

export interface CourseTeacher {
  id: string;
  courseId: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  roleInCourse: string;
  assignedAt: string;
}

export interface CourseStudentDevice {
  id: string;
  courseId: string;
  studentName: string;
  normalizedStudentName: string;
  deviceId: string;
  userAgent?: string;
  ipAddress?: string;
  linkedAt: string;
  lastActiveAt: string;
}

export interface BindStudentDeviceInput {
  courseId: string;
  studentName: string;
  deviceId: string;
  userAgent?: string;
  ipAddress?: string;
}

