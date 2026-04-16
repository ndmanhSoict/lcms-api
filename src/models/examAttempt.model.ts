// ════════════════════════════════════════════════════════════
// EXAM ATTEMPT
// ════════════════════════════════════════════════════════════
import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  ATTEMPT_STATUSES, AttemptStatus,
  QUESTION_TYPES, QuestionType,
} from '../shared/constants/roles.js';

export interface IExamAnswer {
  questionId: Types.ObjectId;
  questionOrder: number;
  answer?: any;
  isFlagged: boolean;
  answeredAt?: Date;
}

export interface IAnswerResult {
  questionId: Types.ObjectId;
  questionType: QuestionType;
  studentAnswer?: any;
  correctAnswer?: any;
  isCorrect?: boolean;
  scoreEarned?: number;
}

export interface IEssayGrade {
  questionId: Types.ObjectId;
  score: number;
  feedback?: string;
  gradedBy: Types.ObjectId;
  gradedAt: Date;
}

export interface IExamAttempt extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;
  examId: Types.ObjectId;
  studentId: Types.ObjectId;
  classId: Types.ObjectId;
  status: AttemptStatus;
  startedAt: Date;
  submittedAt?: Date;
  /** Server-side timer — chống gian lận thời gian */
  timeRemainingSeconds?: number;
  answers: IExamAnswer[];
  lastSavedAt?: Date;
  score?: number;
  totalScore?: number;
  autoScore?: number;
  manualScore?: number;
  gradedAt?: Date;
  gradedBy?: Types.ObjectId;
  answerResults: IAnswerResult[];
  essayGrades: IEssayGrade[];
  ipAddress?: string;
  userAgent?: string;
  tabSwitchCount: number;
  createdAt: Date;
  updatedAt?: Date;
}

const ExamAnswerSchema = new Schema<IExamAnswer>(
  {
    questionId:    { type: Schema.Types.ObjectId, required: true },
    questionOrder: { type: Number, required: true },
    answer:        { type: Schema.Types.Mixed, default: null },
    isFlagged:     { type: Boolean, default: false },
    answeredAt:    { type: Date, default: null },
  },
  { _id: false }
);

const AnswerResultSchema = new Schema<IAnswerResult>(
  {
    questionId:    { type: Schema.Types.ObjectId, required: true },
    questionType:  { type: String, enum: Object.values(QUESTION_TYPES), required: true },
    studentAnswer: { type: Schema.Types.Mixed, default: null },
    correctAnswer: { type: Schema.Types.Mixed, default: null },
    isCorrect:     { type: Boolean, default: null },
    scoreEarned:   { type: Number, default: null },
  },
  { _id: false }
);

const EssayGradeSchema = new Schema<IEssayGrade>(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    score:      { type: Number, required: true },
    feedback:   { type: String, default: null },
    gradedBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gradedAt:   { type: Date, required: true },
  },
  { _id: false }
);

const ExamAttemptSchema = new Schema<IExamAttempt>(
  {
    schemaVersion:         { type: Number, default: 1 },
    branchId:              { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    examId:                { type: Schema.Types.ObjectId, ref: 'Exam',   required: true },
    studentId:             { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    classId:               { type: Schema.Types.ObjectId, ref: 'Class',  required: true },
    status: {
      type: String,
      enum: Object.values(ATTEMPT_STATUSES),
      required: true,
      default: ATTEMPT_STATUSES.IN_PROGRESS,
    },
    startedAt:             { type: Date, required: true, default: () => new Date() },
    submittedAt:           { type: Date, default: null },
    timeRemainingSeconds:  { type: Number, default: null },
    answers:               { type: [ExamAnswerSchema], default: [] },
    lastSavedAt:           { type: Date, default: null },
    score:                 { type: Number, default: null },
    totalScore:            { type: Number, default: null },
    autoScore:             { type: Number, default: null },
    manualScore:           { type: Number, default: null },
    gradedAt:              { type: Date, default: null },
    gradedBy:              { type: Schema.Types.ObjectId, ref: 'User', default: null },
    answerResults:         { type: [AnswerResultSchema], default: [] },
    essayGrades:           { type: [EssayGradeSchema], default: [] },
    ipAddress:             { type: String, default: null },
    userAgent:             { type: String, default: null },
    tabSwitchCount:        { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'exam_attempts',
  }
);

// Unique: 1 HS chỉ làm 1 lần / đề thi
ExamAttemptSchema.index(
  { examId: 1, studentId: 1 },
  { unique: true, name: 'idx_attempts_exam_student' }
);
ExamAttemptSchema.index({ studentId: 1, status: 1 }, { name: 'idx_attempts_student_status' });
ExamAttemptSchema.index({ examId: 1, status: 1 },    { name: 'idx_attempts_exam_status' });

export const ExamAttempt =
  mongoose.models.ExamAttempt ||
  mongoose.model<IExamAttempt>('ExamAttempt', ExamAttemptSchema, 'exam_attempts');