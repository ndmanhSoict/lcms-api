import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  EXAM_STATUSES, ExamStatus,
  QUESTION_TYPES, QuestionType,
} from '../shared/constants/roles.js';

// ════════════════════════════════════════════════════════════
// EXAM
// ════════════════════════════════════════════════════════════

export interface IExamConfig {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultAfter: 'submit' | 'graded' | 'teacher_release';
  allowedAttempts: number;
}

/**
 * Snapshot câu hỏi tại thời điểm publish — immutable sau khi publish.
 * Không tham chiếu question_bank nữa (tránh bị ảnh hưởng nếu câu hỏi bị sửa/xóa).
 */
export interface IExamQuestion {
  questionId: Types.ObjectId;   // ref gốc để truy vết
  questionType: QuestionType;
  content: string;
  imageUrl?: string;
  options?: Array<{ key: string; content: string }>;
  correctAnswer?: QuestionAnswerValue;
  score: number;
  order: number;
}

export interface IExam extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;
  classId: Types.ObjectId;
  targetType: 'class' | 'course';
  teacherId: Types.ObjectId;
  title: string;
  description?: string;
  durationMinutes?: number;
  totalScore?: number;
  passingScore?: number;
  config?: IExamConfig;
  availableFrom?: Date;
  availableTo?: Date;
  /** Embed snapshot câu hỏi — immutable sau publish */
  questions: IExamQuestion[];
  status: ExamStatus;
  resultPublishedAt?: Date;
  resultPublishedBy?: Types.ObjectId;
  /** Denorm counter */
  attemptCount: number;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

const ExamQuestionSchema = new Schema<IExamQuestion>(
  {
    questionId:   { type: Schema.Types.ObjectId, ref: 'QuestionBank', required: true },
    questionType: { type: String, enum: Object.values(QUESTION_TYPES), required: true },
    content:      { type: String, required: true },
    imageUrl:     { type: String, default: null },
    options: {
      type: [{ key: String, content: String }],
      default: null,
    },
    correctAnswer: { type: Schema.Types.Mixed, default: null },
    score:         { type: Number, required: true },
    order:         { type: Number, required: true },
  },
  { _id: false }
);

const ExamConfigSchema = new Schema<IExamConfig>(
  {
    shuffleQuestions: { type: Boolean, default: true },
    shuffleOptions:   { type: Boolean, default: true },
    showResultAfter:  {
      type: String,
      enum: ['submit', 'graded', 'teacher_release'],
      default: 'teacher_release',
    },
    allowedAttempts:  { type: Number, default: 1 },
  },
  { _id: false }
);

const ExamSchema = new Schema<IExam>(
  {
    schemaVersion:   { type: Number, default: 1 },
    branchId:        { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    classId:         { type: Schema.Types.ObjectId, ref: 'Class',  required: true },
    targetType:      { type: String, enum: ['class', 'course'], default: 'class' },
    teacherId:       { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    title:           { type: String, required: true },
    description:     { type: String, default: null },
    durationMinutes: { type: Number, default: null },
    totalScore:      { type: Number, default: null },
    passingScore:    { type: Number, default: null },
    config:          { type: ExamConfigSchema, default: null },
    availableFrom:   { type: Date, default: null },
    availableTo:     { type: Date, default: null },
    questions:       { type: [ExamQuestionSchema], default: [] },
    status: {
      type: String,
      enum: Object.values(EXAM_STATUSES),
      required: true,
      default: EXAM_STATUSES.DRAFT,
    },
    resultPublishedAt: { type: Date, default: null },
    resultPublishedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    attemptCount:      { type: Number, default: 0 },
    deletedAt:         { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'exams',
  }
);

ExamSchema.index(
  { classId: 1, status: 1, availableFrom: -1 },
  { name: 'idx_exams_class_status' }
);
ExamSchema.index({ branchId: 1, status: 1 }, { name: 'idx_exams_branch_status' });
ExamSchema.index({ teacherId: 1, status: 1 }, { name: 'idx_exams_teacher' });

export const Exam =
  mongoose.models.Exam || mongoose.model<IExam>('Exam', ExamSchema, 'exams');

