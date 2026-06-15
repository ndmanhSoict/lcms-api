import mongoose, { Schema, Document, Types } from 'mongoose';
import { SUBMISSION_STATUSES, SubmissionStatus } from '../shared/constants/roles.js';

export interface ISubmission extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;
  assignmentId: Types.ObjectId;
  studentId: Types.ObjectId;
  classId: Types.ObjectId;
  contentText?: string;
  attachmentUrls: string[];
  answers: ISubmissionAnswer[];
  submittedAt?: Date;
  isLate: boolean;
  resubmitCount: number;
  status: SubmissionStatus;
  score?: number;
  maxScore?: number;
  feedback?: string;
  gradedAt?: Date;
  gradedBy?: Types.ObjectId;
  revisionRequested: boolean;
  revisionNote?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ISubmissionAnswer {
  questionId: string;
  value: string | string[];
  score?: number;
  isCorrect?: boolean;
}

const SubmissionAnswerSchema = new Schema<ISubmissionAnswer>(
  {
    questionId: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    score: { type: Number, default: null },
    isCorrect: { type: Boolean, default: null },
  },
  { _id: false }
);

const SubmissionSchema = new Schema<ISubmission>(
  {
    schemaVersion: { type: Number, default: 1 },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    contentText: { type: String, default: null },
    attachmentUrls: { type: [String], default: [] },
    answers: { type: [SubmissionAnswerSchema], default: [] },
    submittedAt: { type: Date, default: null },
    isLate: { type: Boolean, default: false },
    resubmitCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(SUBMISSION_STATUSES),
      required: true,
      default: SUBMISSION_STATUSES.DRAFT,
    },
    score: { type: Number, default: null },
    maxScore: { type: Number, default: null },
    feedback: { type: String, default: null },
    gradedAt: { type: Date, default: null },
    gradedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    revisionRequested: { type: Boolean, default: false },
    revisionNote: { type: String, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'submissions',
  }
);

// Unique: 1 HS chỉ nộp 1 bài / assignment
SubmissionSchema.index(
  { assignmentId: 1, studentId: 1 },
  { unique: true, name: 'idx_submissions_assign_student' }
);
// Q06: GV xem bài chờ chấm
SubmissionSchema.index(
  { assignmentId: 1, status: 1, submittedAt: 1 },
  { name: 'idx_submissions_assign_status' }
);
// Q10: xem bài theo học sinh + lớp
SubmissionSchema.index({ studentId: 1, classId: 1 }, { name: 'idx_submissions_student_class' });

export const Submission =
  mongoose.models.Submission ||
  mongoose.model<ISubmission>('Submission', SubmissionSchema, 'submissions');
