-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Institution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',
    "coordinatorEmail" TEXT NOT NULL,
    "enabledAxesCsv" TEXT NOT NULL DEFAULT 'LITERAL,INFERENCIAL,CRITICO',
    "aiMonthlyQuota" INTEGER NOT NULL DEFAULT 200,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Institution" ("coordinatorEmail", "createdAt", "domain", "id", "name", "slug", "status") SELECT "coordinatorEmail", "createdAt", "domain", "id", "name", "slug", "status" FROM "Institution";
DROP TABLE "Institution";
ALTER TABLE "new_Institution" RENAME TO "Institution";
CREATE UNIQUE INDEX "Institution_slug_key" ON "Institution"("slug");
CREATE TABLE "new_Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "monthlyPriceArs" INTEGER NOT NULL,
    "maxUsers" INTEGER NOT NULL DEFAULT 50
);
INSERT INTO "new_Plan" ("id", "monthlyPriceArs", "name") SELECT "id", "monthlyPriceArs", "name" FROM "Plan";
DROP TABLE "Plan";
ALTER TABLE "new_Plan" RENAME TO "Plan";
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Student_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("courseId", "id", "initials", "name") SELECT "courseId", "id", "initials", "name" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE INDEX "Student_courseId_idx" ON "Student"("courseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
