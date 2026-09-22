-- Tabla intermedia para asignación de docentes a aulas físicas y cursos
CREATE TABLE IF NOT EXISTS "CourseTeacher" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "courseId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "roleInCourse" TEXT NOT NULL DEFAULT 'TITULAR',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseTeacher_courseId_teacherId_key" UNIQUE ("courseId", "teacherId"),
    CONSTRAINT "CourseTeacher_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CourseTeacher_courseId_idx" ON "CourseTeacher"("courseId");
CREATE INDEX IF NOT EXISTS "CourseTeacher_teacherId_idx" ON "CourseTeacher"("teacherId");

-- Sincronizar docentes actuales de la tabla Course hacia CourseTeacher
INSERT INTO "CourseTeacher" ("courseId", "teacherId", "roleInCourse")
SELECT "id", "teacherId", 'TITULAR'
FROM "Course"
WHERE "teacherId" IS NOT NULL AND "teacherId" != ''
ON CONFLICT ("courseId", "teacherId") DO NOTHING;
