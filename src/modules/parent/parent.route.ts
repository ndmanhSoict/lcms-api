import { Router } from 'express';
import { ParentController } from './parent.controller.js';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { createParentSchema, getParentsSchema, updateParentSchema } from './parent.schema.js';

export const parentRouter = Router();
const controller = new ParentController();

parentRouter.use(authenticate);

parentRouter.get('/my-overview', authorize(ROLES.PARENT), controller.getMyOverview);

parentRouter.use(authorize(ROLES.BRANCH_OWNER, ROLES.STAFF));

parentRouter.post('/', validate(createParentSchema), controller.createParent);
parentRouter.get('/', validate(getParentsSchema), controller.getParents);
parentRouter.get('/:id', controller.getParentById);
parentRouter.patch('/:id', validate(updateParentSchema), controller.updateParent);
parentRouter.delete('/:id', controller.deleteParent);
