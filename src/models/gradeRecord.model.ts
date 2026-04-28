import mongoose, { Schema, Document, Types } from 'mongoose';
import { GRADE_STATUSES, GradeStatus } from '../shared/constants/roles.js';

export interface IExamScore {
  examId: Types.ObjectId;
  title: string;
  score: number;
  totalScore: number;
  weight: number;
  examDate?: Date;
}

export interface IGradeRecord extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;
  studentId: Types.ObjectId;
  classId: Types.ObjectId;
  teacherId: Types.ObjectId;
  academicPeriod: string;
  assignmentAvg?: number;
  examScores: IExamScore[];
  /** Weighted sum: sum(score * weight) */
  finalScore?: number;
  teacherComment?: string;
  status: GradeStatus;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

const ExamScoreSchema = new Schema<IExamScore>(
  {
    examId:     { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
    title:      { type: String, required: true },
    score:      { type: Number, required: true },
    totalScore: { type: Number, required: true },
    weight:     { type: Number, required: true },
    examDate:   { type: Date, default: null },
  },
  { _id: false }
);

const GradeRecordSchema = new Schema<IGradeRecord>(
  {
    schemaVersion:  { type: Number, default: 1 },
    branchId:       { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    studentId:      { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    classId:        { type: Schema.Types.ObjectId, ref: 'Class',  required: true },
    teacherId:      { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    academicPeriod: { type: String, required: true },
    assignmentAvg:  { type: Number, default: null },
    examScores:     { type: [ExamScoreSchema], default: [] },
    finalScore:     { type: Number, default: null },
    teacherComment: { type: String, default: null },
    status: {
      type: String,
      enum: Object.values(GRADE_STATUSES),
      required: true,
      default: GRADE_STATUSES.DRAFT,
    },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'grade_records',
  }
);

// Unique: 1 HS chỉ có 1 học bạ / lớp / kỳ học
GradeRecordSchema.index(
  { studentId: 1, classId: 1, academicPeriod: 1 },
  { unique: true, name: 'idx_grade_student_class_period' }
);
GradeRecordSchema.index(
  { classId: 1, academicPeriod: 1 },
  { name: 'idx_grade_class_period' }
);
GradeRecordSchema.index(
  { studentId: 1, status: 1 },
  { name: 'idx_grade_student_status' }
);

export const GradeRecord =
  mongoose.models.GradeRecord ||
  mongoose.model<IGradeRecord>('GradeRecord', GradeRecordSchema, 'grade_records');
