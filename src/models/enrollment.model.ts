import mongoose, { Schema, Document, Types } from 'mongoose';
import { LEFT_REASONS, LeftReason } from '../shared/constants/roles.js';

export interface IClassSnapshot {
  name: string;
  subjectName: string;
  teacherName: string;
}

export interface IEnrollment extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;
  studentId: Types.ObjectId;
  classId: Types.ObjectId;
  /** Snapshot tại thời điểm xếp lớp — lớp có thể đổi tên sau */
  classSnapshot?: IClassSnapshot;
  enrolledAt: Date;
  /** null = đang học | ISODate = đã rời lớp */
  leftAt?: Date;
  leftReason?: LeftReason;
  enrolledBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
}

const ClassSnapshotSchema = new Schema<IClassSnapshot>(
  {
    name:        { type: String, required: true },
    subjectName: { type: String, required: true },
    teacherName: { type: String, required: true },
  },
  { _id: false }
);

const EnrollmentSchema = new Schema<IEnrollment>(
  {
    schemaVersion: { type: Number, default: 1 },
    branchId:      { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    studentId:     { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    classId:       { type: Schema.Types.ObjectId, ref: 'Class',  required: true },
    classSnapshot: { type: ClassSnapshotSchema, default: null },
    enrolledAt:    { type: Date, required: true, default: () => new Date() },
    leftAt:        { type: Date, default: null },
    leftReason: {
      type: String,
      enum: [...Object.values(LEFT_REASONS), null],
      default: null,
    },
    enrolledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'enrollments',
  }
);

// ── Indexes ──────────────────────────────────────────────────
EnrollmentSchema.index(
  { studentId: 1, enrolledAt: -1 },
  { name: 'idx_enrollments_student_date' }
);
// Tìm tất cả lớp HS đang học (leftAt = null)
EnrollmentSchema.index(
  { studentId: 1, leftAt: 1 },
  { name: 'idx_enrollments_student_active' }
);
// Tìm tất cả HS đang học trong 1 lớp
EnrollmentSchema.index(
  { classId: 1, leftAt: 1 },
  { name: 'idx_enrollments_class_active' }
);
// Ngăn xếp 1 HS vào cùng 1 lớp 2 lần khi đang active
EnrollmentSchema.index(
  { studentId: 1, classId: 1 },
  {
    unique: true,
    partialFilterExpression: { leftAt: null },
    name: 'idx_enrollments_student_class_active_unique',
  }
);
EnrollmentSchema.index(
  { branchId: 1, studentId: 1 },
  { name: 'idx_enrollments_branch_student' }
);

export const Enrollment =
  mongoose.models.Enrollment ||
  mongoose.model<IEnrollment>('Enrollment', EnrollmentSchema, 'enrollments');