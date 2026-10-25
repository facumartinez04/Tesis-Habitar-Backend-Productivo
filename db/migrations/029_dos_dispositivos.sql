ALTER TABLE "CourseStudentDevice" DROP CONSTRAINT IF EXISTS "uq_course_normalized_student";
ALTER TABLE "CourseStudentDevice" DROP CONSTRAINT IF EXISTS "uq_course_student_device";
ALTER TABLE "CourseStudentDevice"
  ADD CONSTRAINT "uq_course_student_device" UNIQUE ("courseId", "normalizedStudentName", "deviceId");
