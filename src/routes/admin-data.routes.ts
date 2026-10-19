import { Router } from 'express';
import { adminDataController as c } from '../controllers/admin-data.controller';
import { requireAuth, requirePlatformAdmin } from '../middlewares/auth.middleware';

// Datos de cada institución para el administrador de la plataforma: revisar y borrar.
export const adminDataRouter = Router();

adminDataRouter.use(requireAuth, requirePlatformAdmin);

adminDataRouter.get('/institutions/:institutionId/activities', c.activities.bind(c));
adminDataRouter.get('/institutions/:institutionId/courses', c.courses.bind(c));
adminDataRouter.get('/institutions/:institutionId/students', c.students.bind(c));
adminDataRouter.get('/institutions/:institutionId/deletions', c.deletions.bind(c));

adminDataRouter.delete('/activities/:id', c.deleteActivity.bind(c));
adminDataRouter.delete('/courses/:id', c.deleteCourse.bind(c));
adminDataRouter.delete('/students/:id', c.deleteStudent.bind(c));
