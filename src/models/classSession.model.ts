import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  SESSION_TYPES, SessionType,
  SESSION_STATUSES, SessionStatus,
  ATTENDANCE_SUBMISSION_STATUS,
} from '../shared/constants/roles.js';

export interface IMaterial {
  name: string;
  url: string;
}

export interface IClassSession extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;
  classId: Types.ObjectId;
  teacherId?: Types.ObjectId;
  sessionDate: Date;
  startTime?: string;
  endTime?: string;
  roomCode?: string;
  sessionType: SessionType;
  status: SessionStatus;
  note?: string;
  /** "pending" = chưa điểm danh, "submitted" = đã điểm danh */
  attendanceStatus: 'pending' | 'submitted';
  materials: IMaterial[];
  onlineMeetingUrl?: string;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

const MaterialSchema = new Schema<IMaterial>(
  {
    name: { type: String, required: true },
    url:  { type: String, required: true },
  },
  { _id: false }
);

const ClassSessionSchema = new Schema<IClassSession>(
  {
    schemaVersion: { type: Number, default: 1 },
    branchId:      { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    classId:       { type: Schema.Types.ObjectId, ref: 'Class',  required: true },
    teacherId:     { type: Schema.Types.ObjectId, ref: 'User',   default: null },
    sessionDate:   { type: Date, required: true },
    startTime:     { type: String, default: null },
    endTime:       { type: String, default: null },
    roomCode:      { type: String, default: null },
    sessionType: {
      type: String,
      enum: Object.values(SESSION_TYPES),
      default: SESSION_TYPES.REGULAR,
    },
    status: {
      type: String,
      enum: Object.values(SESSION_STATUSES),
      required: true,
      default: SESSION_STATUSES.SCHEDULED,
    },
    note: { type: String, default: null },
    attendanceStatus: {
      type: String,
      enum: Object.values(ATTENDANCE_SUBMISSION_STATUS),
      default: ATTENDANCE_SUBMISSION_STATUS.PENDING,
    },
    materials:        { type: [MaterialSchema], default: [] },
    onlineMeetingUrl: { type: String, default: null },
    deletedAt:        { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'class_sessions',
  }
);

// ── Indexes ──────────────────────────────────────────────────
// Unique: 1 lớp chỉ có 1 session mỗi ngày
ClassSessionSchema.index(
  { classId: 1, sessionDate: 1 },
  { unique: true, name: 'idx_sessions_class_date_unique' }
);
// Q02: GV xem lịch dạy hôm nay
ClassSessionSchema.index(
  { teacherId: 1, sessionDate: 1, status: 1 },
  { name: 'idx_sessions_teacher_date' }
);
// Q03: HS/PH xem lịch học theo lớp
ClassSessionSchema.index(
  { classId: 1, sessionDate: 1, status: 1 },
  { name: 'idx_sessions_class_date_status' }
);
ClassSessionSchema.index(
  { branchId: 1, sessionDate: 1 },
  { name: 'idx_sessions_branch_date' }
);

export const ClassSession =
  mongoose.models.ClassSession ||
  mongoose.model<IClassSession>('ClassSession', ClassSessionSchema, 'class_sessions');