// src/models/user.model.ts
import mongoose, { Schema, Document } from 'mongoose';
import { ROLES, RoleType } from '../shared/constants/roles.js';

export interface IUser extends Document {
  userCode: string;
  username: string;
  passwordHash: string;
  role: RoleType;
  branchId?: mongoose.Types.ObjectId;
  fullName: string;
  phone?: string;
  email: string;
  isActive: boolean;
}

const UserSchema: Schema = new Schema(
  {
    userCode: { type: String, required: true, unique: true, sparse: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.STUDENT },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: false },
    fullName: { type: String, required: true },
    phone: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
