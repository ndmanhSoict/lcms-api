import mongoose, { Schema, Document, Types } from 'mongoose';

// ── Embedded types ───────────────────────────────────────────
export interface ISessionSlot {
  name: string;       // "Ca sáng"
  startTime: string;  // "07:00"
  endTime: string;    // "09:00"
}

export interface IRoom {
  code: string;       // "P01"
  name: string;       // "Phòng A"
}

// ── Document interface ───────────────────────────────────────
export interface IBranch extends Document {
  schemaVersion: number;
  branchCode: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  ownerId?: Types.ObjectId;
  timezone: string;
  defaultFeePerSession?: number;
  defaultSessionSlots: ISessionSlot[];
  rooms: IRoom[];
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

// ── Schema ───────────────────────────────────────────────────
const SessionSlotSchema = new Schema<ISessionSlot>(
  {
    name:      { type: String, required: true },
    startTime: { type: String, required: true },
    endTime:   { type: String, required: true },
  },
  { _id: false }
);

const RoomSchema = new Schema<IRoom>(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
  },
  { _id: false }
);

const BranchSchema = new Schema<IBranch>(
  {
    schemaVersion:        { type: Number, default: 1 },
    branchCode:           { type: String, required: true, unique: true },
    name:                 { type: String, required: true },
    address:              { type: String, default: null },
    phone:                { type: String, default: null },
    email:                { type: String, default: null },
    logoUrl:              { type: String, default: null },
    ownerId:              { type: Schema.Types.ObjectId, ref: 'User', default: null },
    timezone:             { type: String, default: 'Asia/Ho_Chi_Minh' },
    defaultFeePerSession: { type: Number, default: null },
    defaultSessionSlots:  { type: [SessionSlotSchema], default: [] },
    rooms:                { type: [RoomSchema], default: [] },
    isActive:             { type: Boolean, required: true, default: true },
    deletedAt:            { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'branches',
  }
);

// ── Indexes ──────────────────────────────────────────────────
BranchSchema.index({ branchCode: 1 }, { unique: true, name: 'idx_branches_code' });
BranchSchema.index({ isActive: 1 }, { name: 'idx_branches_active' });

export const Branch =
  mongoose.models.Branch || mongoose.model<IBranch>('Branch', BranchSchema, 'branches');