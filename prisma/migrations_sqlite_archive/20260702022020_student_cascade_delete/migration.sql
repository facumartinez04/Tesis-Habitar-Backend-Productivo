-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "studentId" TEXT,
    "studentDisplayName" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Response_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Response_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Response" ("activityId", "id", "studentDisplayName", "studentId", "submittedAt") SELECT "activityId", "id", "studentDisplayName", "studentId", "submittedAt" FROM "Response";
DROP TABLE "Response";
ALTER TABLE "new_Response" RENAME TO "Response";
CREATE INDEX "Response_activityId_idx" ON "Response"("activityId");
CREATE INDEX "Response_studentId_idx" ON "Response"("studentId");
CREATE TABLE "new_StudentResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "literalScore" INTEGER NOT NULL,
    "inferencialScore" INTEGER NOT NULL,
    "criticoScore" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentResult_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentResult_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StudentResult" ("activityId", "createdAt", "criticoScore", "id", "inferencialScore", "literalScore", "responseId", "studentId") SELECT "activityId", "createdAt", "criticoScore", "id", "inferencialScore", "literalScore", "responseId", "studentId" FROM "StudentResult";
DROP TABLE "StudentResult";
ALTER TABLE "new_StudentResult" RENAME TO "StudentResult";
CREATE UNIQUE INDEX "StudentResult_responseId_key" ON "StudentResult"("responseId");
CREATE INDEX "StudentResult_studentId_idx" ON "StudentResult"("studentId");
CREATE INDEX "StudentResult_activityId_idx" ON "StudentResult"("activityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
