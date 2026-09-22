import { Router } from 'express';
import { roleController } from '../controllers/role.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';

export const roleRouter = Router();

roleRouter.use(requireAuth, requireRole('ADMIN'));

roleRouter.get('/modules', roleController.listModules.bind(roleController));
roleRouter.get('/', roleController.getAll.bind(roleController));
roleRouter.get('/:id', roleController.getOne.bind(roleController));
roleRouter.post('/', roleController.create.bind(roleController));
roleRouter.patch('/:id', roleController.update.bind(roleController));
roleRouter.delete('/:id', roleController.remove.bind(roleController));
