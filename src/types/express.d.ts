import { RoleType } from '../constants/roles';
import { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId: Types.ObjectId;
        email: string;
        role: RoleType;
      };
      requestId: string;
    }
  }
}

export {};
