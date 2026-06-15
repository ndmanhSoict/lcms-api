import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IClassroom extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;
  code: string;
  capacity: number;
  detail?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
  createdBy?: Types.ObjectId;
  deletedAt?: Date;
}

const ClassroomSchema = new Schema<IClassroom>(
  {
    schemaVersion: { type: Number, default: 1 },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    code: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    detail: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'classrooms',
  }
);

ClassroomSchema.index(
  { branchId: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
    name: 'idx_classrooms_branch_code_active_unique',
  }
);
ClassroomSchema.index({ branchId: 1, isActive: 1 }, { name: 'idx_classrooms_branch_active' });

export const Classroom =
  mongoose.models.Classroom || mongoose.model<IClassroom>('Classroom', ClassroomSchema);
