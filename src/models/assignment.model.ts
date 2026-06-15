import mongoose, { Schema, Document, Types } from 'mongoose';
import { ASSIGNMENT_TYPES, AssignmentType } from '../shared/constants/roles.js';

// ════════════════════════════════════════════════════════════
// ASSIGNMENT
// ════════════════════════════════════════════════════════════

export interface ISubmissionConfig {
  allowLate: boolean;
  allowText: boolean;
  allowFile: boolean;
  maxFileSizeMb?: number;
  allowedFileTypes?: string[];
}

export interface IAssignmentOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface IAssignmentQuestion {
  _id?: Types.ObjectId;
  prompt: string;
  type: 'single_choice' | 'multiple_choice' | 'short_text';
  options: IAssignmentOption[];
  points?: number;
}

export interface IAssignment extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;
  classId: Types.ObjectId;
  teacherId: Types.ObjectId;
  /** Liên kết buổi học nếu giao bài trong buổi */
  sessionId?: Types.ObjectId;
  title: string;
  description?: string;
  attachmentUrls: string[];
  questions: IAssignmentQuestion[];
  assignmentType: AssignmentType;
  dueDate?: Date;
  maxScore?: number;
  isGraded: boolean;
  autoGrade: boolean;
  releaseScoreAfterDueDate: boolean;
  answersReleasedAt?: Date;
  answersReleasedBy?: Types.ObjectId;
  visibleToParent: boolean;
  submissionConfig?: ISubmissionConfig;
  status: 'active' | 'closed' | 'draft';
  /** Denorm counter — cập nhật khi HS nộp bài */
  submissionCount: number;
  /** Denorm counter — cập nhật khi GV chấm xong */
  gradedCount: number;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

const SubmissionConfigSchema = new Schema<ISubmissionConfig>(
  {
    allowLate: { type: Boolean, default: true },
    allowText: { type: Boolean, default: true },
    allowFile: { type: Boolean, default: true },
    maxFileSizeMb: { type: Number, default: null },
    allowedFileTypes: { type: [String], default: [] },
  },
  { _id: false }
);

const AssignmentOptionSchema = new Schema<IAssignmentOption>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

const AssignmentQuestionSchema = new Schema<IAssignmentQuestion>(
  {
    prompt: { type: String, required: true },
    type: {
      type: String,
      enum: ['single_choice', 'multiple_choice', 'short_text'],
      required: true,
    },
    options: { type: [AssignmentOptionSchema], default: [] },
    points: { type: Number, default: null },
  },
  { _id: true }
);

const AssignmentSchema = new Schema<IAssignment>(
  {
    schemaVersion: { type: Number, default: 1 },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'ClassSession', default: null },
    title: { type: String, required: true },
    description: { type: String, default: null },
    attachmentUrls: { type: [String], default: [] },
    questions: { type: [AssignmentQuestionSchema], default: [] },
    assignmentType: {
      type: String,
      enum: Object.values(ASSIGNMENT_TYPES),
      default: ASSIGNMENT_TYPES.HOMEWORK,
    },
    dueDate: { type: Date, default: null },
    maxScore: { type: Number, default: null },
    isGraded: { type: Boolean, default: true },
    autoGrade: { type: Boolean, default: false },
    releaseScoreAfterDueDate: { type: Boolean, default: false },
    answersReleasedAt: { type: Date, default: null },
    answersReleasedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    visibleToParent: { type: Boolean, default: true },
    submissionConfig: { type: SubmissionConfigSchema, default: null },
    status: {
      type: String,
      enum: ['active', 'closed', 'draft'],
      required: true,
      default: 'draft',
    },
    submissionCount: { type: Number, default: 0 },
    gradedCount: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'assignments',
  }
);

AssignmentSchema.index(
  { classId: 1, dueDate: -1, status: 1 },
  { name: 'idx_assignments_class_due' }
);
AssignmentSchema.index({ teacherId: 1, status: 1 }, { name: 'idx_assignments_teacher' });
AssignmentSchema.index({ branchId: 1, status: 1 }, { name: 'idx_assignments_branch_status' });

export const Assignment =
  mongoose.models.Assignment ||
  mongoose.model<IAssignment>('Assignment', AssignmentSchema, 'assignments');

// ════════════════════════════════════════════════════════════
// SUBMISSION
// ════════════════════════════════════════════════════════════
