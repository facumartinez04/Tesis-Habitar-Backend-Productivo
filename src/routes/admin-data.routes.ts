import { Router } from 'express';
import { adminDataController as c } from '../controllers/admin-data.controller';
import { requireAuth, requirePlatformAdmin } from '../middlewares/auth.middleware';
import { adminAiController as ai } from '../controllers/admin-ai.controller';

export const adminDataRouter = Router();

adminDataRouter.use(requireAuth, requirePlatformAdmin);

adminDataRouter.get('/institutions/:institutionId/activities', c.activities.bind(c));
adminDataRouter.get('/institutions/:institutionId/courses', c.courses.bind(c));
adminDataRouter.get('/institutions/:institutionId/students', c.students.bind(c));
adminDataRouter.get('/institutions/:institutionId/deletions', c.deletions.bind(c));

adminDataRouter.post('/institutions/:institutionId/pause', c.pauseInstitution.bind(c));
adminDataRouter.delete('/institutions/:institutionId/pause', c.resumeInstitution.bind(c));
adminDataRouter.delete('/activities/:id', c.deleteActivity.bind(c));
adminDataRouter.delete('/courses/:id', c.deleteCourse.bind(c));
adminDataRouter.delete('/students/:id', c.deleteStudent.bind(c));

adminDataRouter.get('/ai-costs', ai.costs.bind(ai));
adminDataRouter.get('/ai-costs/institutions/:institutionId', ai.institutionCosts.bind(ai));
adminDataRouter.patch('/institutions/:institutionId/ai-budget', ai.setBudget.bind(ai));
adminDataRouter.get('/ai-prices', ai.prices.bind(ai));
adminDataRouter.put('/ai-prices', ai.upsertPrice.bind(ai));
adminDataRouter.delete('/ai-prices/:provider/:model', ai.deletePrice.bind(ai));
