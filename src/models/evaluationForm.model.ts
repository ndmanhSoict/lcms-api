import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  EVALUATION_PERIOD_TYPES,
  EVALUATION_STATUSES,
  EvaluationPeriodType,
  EvaluationStatus,
  RoleType,
} from '../shared/constants/roles.js';

export interface IEvaluationCriteria {
  label: string;
  score?: number;
  maxScore?: number;
  comment?: string;
}

export interface IEvaluationForm extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;
  studentId: Types.ObjectId;
  classId: Types.ObjectId;
  sessionId?: Types.ObjectId;
  teacherId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdByRole: RoleType;
  periodType: EvaluationPeriodType;
  periodLabel: string;
  month?: string;
  title: string;
  content: string;
  strengths?: string;
  improvements?: string;
  recommendations?: string;
  attitudeScore?: number;
  studyScore?: number;
  homeworkScore?: number;
  criteria: IEvaluationCriteria[];
  status: EvaluationStatus;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

const EvaluationCriteriaSchema = new Schema<IEvaluationCriteria>(
  {
    label: { type: String, required: true },
    score: { type: Number, default: null },
    maxScore: { type: Number, default: null },
    comment: { type: String, default: null },
  },
  { _id: true }
);

const EvaluationFormSchema = new Schema<IEvaluationForm>(
  {
    schemaVersion: { type: Number, default: 1 },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'ClassSession', default: null },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByRole: { type: String, required: true },
    periodType: {
      type: String,
      enum: Object.values(EVALUATION_PERIOD_TYPES),
      required: true,
    },
    periodLabel: { type: String, required: true },
    month: { type: String, default: null },
    title: { type: String, required: true },
    content: { type: String, required: true },
    strengths: { type: String, default: null },
    improvements: { type: String, default: null },
    recommendations: { type: String, default: null },
    attitudeScore: { type: Number, default: null },
    studyScore: { type: Number, default: null },
    homeworkScore: { type: Number, default: null },
    criteria: { type: [EvaluationCriteriaSchema], default: [] },
    status: {
      type: String,
      enum: Object.values(EVALUATION_STATUSES),
      required: true,
      default: EVALUATION_STATUSES.PUBLISHED,
    },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'evaluation_forms',
  }
);

EvaluationFormSchema.index(
  { studentId: 1, classId: 1, periodType: 1, createdAt: -1 },
  { name: 'idx_eval_student_class_period' }
);
EvaluationFormSchema.index(
  { classId: 1, periodType: 1, status: 1, createdAt: -1 },
  { name: 'idx_eval_class_period_status' }
);
EvaluationFormSchema.index(
  { branchId: 1, status: 1, createdAt: -1 },
  { name: 'idx_eval_branch_status' }
);

export const EvaluationForm =
  mongoose.models.EvaluationForm ||
  mongoose.model<IEvaluationForm>('EvaluationForm', EvaluationFormSchema, 'evaluation_forms');
