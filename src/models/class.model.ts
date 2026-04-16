import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  CLASS_TYPES, ClassType,
  CLASS_STATUSES, ClassStatus,
} from '../shared/constants/roles.js';

// ── Embedded types ───────────────────────────────────────────
export interface ISubjectEmbed {
  name: string;    // "Toán học" — bắt buộc
  code?: string;   // "TOAN"    — filter/group
  color?: string;  // "#4F8EF7" — calendar
  icon?: string;   // "📐"
}

export interface IWeeklyScheduleSlot {
  dayOfWeek: number;   // 0 = CN, 1 = T2 … 6 = T7
  startTime: string;   // "HH:mm"
  endTime: string;     // "HH:mm"
  roomCode?: string;
}

export interface ITeacherSnapshot {
  fullName: string;
  avatarUrl?: string;
}

/** Dùng khi class_type = "course" */
export interface ICourseInfo {
  startDate: Date;
  endDate: Date;
  totalSessions: number;
  completedSessions: number;
  feePerCourse: number;
}

/** Dùng khi class_type = "ongoing" */
export interface IOngoingInfo {
  feePerSession: number;
  billingCycle: 'monthly' | 'per_session';
}

// ── Document interface ───────────────────────────────────────
export interface IClass extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;

  subject: ISubjectEmbed;
  name: string;
  classCode?: string;
  description?: string;

  teacherId?: Types.ObjectId;
  teacherSnapshot?: ITeacherSnapshot;
  coTeacherIds: Types.ObjectId[];

  classType: ClassType;
  courseInfo?: ICourseInfo;
  ongoingInfo?: IOngoingInfo;

  weeklySchedule: IWeeklyScheduleSlot[];
  maxStudents?: number;
  /** Denorm counter — sync trong transaction */
  studentCount: number;

  status: ClassStatus;
  createdAt: Date;
  updatedAt?: Date;
  createdBy?: Types.ObjectId;
  deletedAt?: Date;
}

// ── Sub-schemas ──────────────────────────────────────────────
const SubjectEmbedSchema = new Schema<ISubjectEmbed>(
  {
    name:  { type: String, required: true },
    code:  { type: String, default: null },
    color: { type: String, default: null },
    icon:  { type: String, default: null },
  },
  { _id: false }
);

const WeeklyScheduleSchema = new Schema<IWeeklyScheduleSlot>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true },
    endTime:   { type: String, required: true },
    roomCode:  { type: String, default: null },
  },
  { _id: false }
);

const TeacherSnapshotSchema = new Schema<ITeacherSnapshot>(
  {
    fullName:  { type: String, required: true },
    avatarUrl: { type: String, default: null },
  },
  { _id: false }
);

const CourseInfoSchema = new Schema<ICourseInfo>(
  {
    startDate:         { type: Date, required: true },
    endDate:           { type: Date, required: true },
    totalSessions:     { type: Number, required: true },
    completedSessions: { type: Number, default: 0 },
    feePerCourse:      { type: Number, required: true },
  },
  { _id: false }
);

const OngoingInfoSchema = new Schema<IOngoingInfo>(
  {
    feePerSession: { type: Number, required: true },
    billingCycle:  {
      type: String,
      enum: ['monthly', 'per_session'],
      default: 'monthly',
    },
  },
  { _id: false }
);

// ── Main schema ──────────────────────────────────────────────
const ClassSchema = new Schema<IClass>(
  {
    schemaVersion: { type: Number, default: 1 },
    branchId:      { type: Schema.Types.ObjectId, ref: 'Branch', required: true },

    subject:     { type: SubjectEmbedSchema, required: true },
    name:        { type: String, required: true },
    classCode:   { type: String, default: null },
    description: { type: String, default: null },

    teacherId:       { type: Schema.Types.ObjectId, ref: 'User', default: null },
    teacherSnapshot: { type: TeacherSnapshotSchema, default: null },
    coTeacherIds:    { type: [Schema.Types.ObjectId], ref: 'User', default: [] },

    classType:   {
      type: String,
      enum: Object.values(CLASS_TYPES),
      required: true,
    },
    courseInfo:  { type: CourseInfoSchema,  default: null },
    ongoingInfo: { type: OngoingInfoSchema, default: null },

    weeklySchedule: { type: [WeeklyScheduleSchema], default: [] },
    maxStudents:    { type: Number, default: null },
    studentCount:   { type: Number, default: 0 },

    status: {
      type: String,
      enum: Object.values(CLASS_STATUSES),
      required: true,
      default: CLASS_STATUSES.UPCOMING,
    },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'classes',
  }
);

// ── Indexes ──────────────────────────────────────────────────
ClassSchema.index({ branchId: 1, status: 1 }, { name: 'idx_classes_branch_status' });
ClassSchema.index(
  { branchId: 1, classCode: 1 },
  { unique: true, sparse: true, name: 'idx_classes_branch_code' }
);
ClassSchema.index({ teacherId: 1, status: 1 }, { name: 'idx_classes_teacher' });
ClassSchema.index({ 'subject.code': 1, branchId: 1 }, { name: 'idx_classes_subject_code' });
ClassSchema.index({ 'subject.name': 1 }, { name: 'idx_classes_subject_name' });

export const Class =
  mongoose.models.Class || mongoose.model<IClass>('Class', ClassSchema, 'classes');