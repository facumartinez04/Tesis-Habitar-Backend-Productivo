-- Migración 011: Dispositivos de alumnos vinculados al aula física y control de unicidad

CREATE TABLE IF NOT EXISTS "CourseStudentDevice" (
  "id" TEXT PRIMARY KEY,
  "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
  "studentName" TEXT NOT NULL,
  "normalizedStudentName" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "userAgent" TEXT NOT NULL DEFAULT '',
  "ipAddress" TEXT NOT NULL DEFAULT '',
  "linkedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lastActiveAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "uq_course_normalized_student" UNIQUE ("courseId", "normalizedStudentName")
);

CREATE INDEX IF NOT EXISTS "idx_course_student_device_course" ON "CourseStudentDevice"("courseId");
CREATE INDEX IF NOT EXISTS "idx_course_student_device_device" ON "CourseStudentDevice"("deviceId");
CREATE INDEX IF NOT EXISTS "idx_course_student_device_norm" ON "CourseStudentDevice"("courseId", "normalizedStudentName");
