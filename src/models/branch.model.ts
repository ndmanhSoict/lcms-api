import mongoose, { Schema, Document } from 'mongoose';

export interface IBranch extends Document {
  branchCode: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  defaultSessionSlots?: string[];
  deletedAt?: Date | null;
}

const BranchSchema: Schema = new Schema(
  {
    branchCode: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    isActive: { type: Boolean, default: true },
    defaultSessionSlots: { type: [String], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true } // Tự động quản lý createdAt và updatedAt
);

export const Branch = mongoose.models.Branch || mongoose.model<IBranch>('Branch', BranchSchema);