import mongoose, { Schema, Document } from 'mongoose';
import { ROLES, RoleType } from '../shared/constants/roles.js';

export interface IUser extends Document {
  schemaVersion: number;
  userCode: string;
  phone: string;
  email?: string;
  username?: string;
  passwordHash: string;
  role: RoleType;
  branchId?: mongoose.Types.ObjectId;
  fullName: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  avatarUrl?: string;
  studentInfo?: any;
  teacherInfo?: any;
  parentInfo?: any;
  isActive: boolean;
  lastLoginAt?: Date;
}

const UserSchema: Schema = new Schema(
  {
    schemaVersion: { type: Number, default: 1 },
    userCode: { type: String, required: true, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    email: { type: String, sparse: true },
    username: { type: String },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: Object.values(ROLES), required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    fullName: { type: String, required: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    avatarUrl: { type: String },
    studentInfo: { type: Object },
    teacherInfo: { type: Object },
    parentInfo: { type: Object },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true } // Tự động quản lý created_at, updated_at
);

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema, 'users');