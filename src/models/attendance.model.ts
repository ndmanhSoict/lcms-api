import mongoose, { Schema, Document, Types } from 'mongoose';
import { ATTENDANCE_STATUS, AttendanceStatus } from '../shared/constants/roles.js';

export interface IAttendanceEditHistory {
  changedFrom: AttendanceStatus;
  changedTo: AttendanceStatus;
  changedBy: Types.ObjectId;
  changedAt: Date;
  reason?: string;
}

export interface IAttendance extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;
  sessionId: Types.ObjectId;
  /** Denorm từ session — tránh $lookup khi tính học phí */
  classId: Types.ObjectId;
  studentId: Types.ObjectId;
  teacherId?: Types.ObjectId;
  status: AttendanceStatus;
  /** Denorm từ session — tăng tốc query lịch sử và tính học phí */
  sessionDate: Date;
  markedAt?: Date;
  /** false = chưa gửi thông báo vắng cho PH */
  absenceNotified: boolean;
  /** Lịch sử sửa điểm danh — embed vì số lần sửa rất ít */
  editHistory: IAttendanceEditHistory[];
  createdAt: Date;
  updatedAt?: Date;
  // Không có deletedAt — attendance không xóa, chỉ sửa (audit trail)
}

const AttendanceEditHistorySchema = new Schema<IAttendanceEditHistory>(
  {
    changedFrom: { type: String, enum: Object.values(ATTENDANCE_STATUS), required: true },
    changedTo: { type: String, enum: Object.values(ATTENDANCE_STATUS), required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, required: true, default: () => new Date() },
    reason: { type: String, default: null },
  },
  { _id: false }
);

const AttendanceSchema = new Schema<IAttendance>(
  {
    schemaVersion: { type: Number, default: 1 },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'ClassSession', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      required: true,
    },
    sessionDate: { type: Date, required: true },
    markedAt: { type: Date, default: null },
    absenceNotified: { type: Boolean, default: false },
    editHistory: { type: [AttendanceEditHistorySchema], default: [] },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'attendances',
  }
);

// ── Indexes ──────────────────────────────────────────────────
// Unique: 1 HS chỉ có 1 record điểm danh / buổi
AttendanceSchema.index(
  { sessionId: 1, studentId: 1 },
  { unique: true, name: 'idx_attend_session_student' }
);
// Tính học phí: buổi có mặt của HS trong tháng
AttendanceSchema.index(
  { studentId: 1, classId: 1, sessionDate: 1 },
  { name: 'idx_attend_student_class_date' }
);
// Background job: gửi thông báo vắng — partial index nhẹ hơn full scan
AttendanceSchema.index(
  { absenceNotified: 1, status: 1 },
  {
    partialFilterExpression: { status: 'absent', absenceNotified: false },
    name: 'idx_attend_absent_unnotified',
  }
);
AttendanceSchema.index({ branchId: 1, sessionDate: 1 }, { name: 'idx_attend_branch_date' });

export const Attendance =
  mongoose.models.Attendance ||
  mongoose.model<IAttendance>('Attendance', AttendanceSchema, 'attendances');
