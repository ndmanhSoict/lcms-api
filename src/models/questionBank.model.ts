import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  QUESTION_TYPES, QuestionType,
  DIFFICULTY_LEVELS, DifficultyLevel,
} from '../shared/constants/roles.js';

// ── Embedded types ───────────────────────────────────────────
/** Dành cho multiple_choice: [{ key: "A", content: "..." }] */
export interface IQuestionOption {
  key: string;
  content: string;
}

// ── Document interface ───────────────────────────────────────
export interface IQuestionBank extends Document {
  schemaVersion: number;
  // Không có branchId — ngân hàng câu hỏi dùng chung toàn hệ thống
  createdBy: Types.ObjectId;

  /** Free text — khớp với classes.subject.name */
  subjectName: string;
  /** Tùy chọn — khớp với classes.subject.code để filter nhanh */
  subjectCode?: string;

  questionType: QuestionType;
  content: string;
  imageUrl?: string;
  difficulty: DifficultyLevel;
  tags: string[];
  chapter?: string;

  /** MC: [{ key, content }] | TF/fill_blank/essay: null */
  options?: IQuestionOption[];
  /**
   * MC/TF: string | fill_blank: string | string[] | essay: null
   * Dùng any để linh hoạt, validation ở service layer
   */
  correctAnswer?: any;
  /** Ngưỡng chấp nhận khi fill_blank (regex hoặc exact) */
  answerTolerance?: string;
  /** Hướng dẫn chấm bài tự luận */
  gradingGuide?: string;

  isReported: boolean;
  reportNote?: string;
  isActive: boolean;
  /** Đếm số lần câu hỏi được dùng trong đề thi */
  usageCount: number;

  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

// ── Sub-schemas ──────────────────────────────────────────────
const QuestionOptionSchema = new Schema<IQuestionOption>(
  {
    key:     { type: String, required: true },
    content: { type: String, required: true },
  },
  { _id: false }
);

// ── Main schema ──────────────────────────────────────────────
const QuestionBankSchema = new Schema<IQuestionBank>(
  {
    schemaVersion: { type: Number, default: 1 },
    createdBy:     { type: Schema.Types.ObjectId, ref: 'User', required: true },

    subjectName: { type: String, required: true },
    subjectCode: { type: String, default: null },

    questionType: {
      type: String,
      enum: Object.values(QUESTION_TYPES),
      required: true,
    },
    content:   { type: String, required: true },
    imageUrl:  { type: String, default: null },
    difficulty: {
      type: String,
      enum: Object.values(DIFFICULTY_LEVELS),
      required: true,
    },
    tags:    { type: [String], default: [] },
    chapter: { type: String, default: null },

    options:         { type: [QuestionOptionSchema], default: null },
    correctAnswer:   { type: Schema.Types.Mixed, default: null },
    answerTolerance: { type: String, default: null },
    gradingGuide:    { type: String, default: null },

    isReported: { type: Boolean, default: false },
    reportNote: { type: String, default: null },
    isActive:   { type: Boolean, default: true },
    usageCount: { type: Number, default: 0 },

    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'question_bank',
  }
);

// ── Indexes ──────────────────────────────────────────────────
// Filter khi GV chọn câu tạo đề thi
QuestionBankSchema.index(
  { subjectCode: 1, questionType: 1, difficulty: 1, isActive: 1 },
  { name: 'idx_qbank_filter' }
);
QuestionBankSchema.index({ subjectName: 1, isActive: 1 }, { name: 'idx_qbank_subject_name' });
QuestionBankSchema.index({ tags: 1 },       { name: 'idx_qbank_tags' });
QuestionBankSchema.index({ createdBy: 1 },  { name: 'idx_qbank_creator' });

export const QuestionBank =
  mongoose.models.QuestionBank ||
  mongoose.model<IQuestionBank>('QuestionBank', QuestionBankSchema, 'question_bank');