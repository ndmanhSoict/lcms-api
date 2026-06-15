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

export interface IGradeAttendanceSummary {
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  attendanceRate: number;
  note?: string;
}

export interface IHomeworkScore {
  assignmentId?: Types.ObjectId;
  title: string;
  score?: number;
  maxScore?: number;
  weight?: number;
  dueDate?: Date;
  submittedAt?: Date;
  feedback?: string;
}

export interface ITestScore {
  examId?: Types.ObjectId;
  title: string;
  score: number;
  totalScore: number;
  weight?: number;
  testDate?: Date;
  note?: string;
}

export interface ISessionComment {
  sessionId?: Types.ObjectId;
  sessionDate: Date;
  topic?: string;
  attendanceStatus?: string;
  attitudeScore?: number;
  comment: string;
}

export interface IMonthlyComment {
  month: string;
  comment: string;
  strengths?: string;
  improvements?: string;
}

export interface IGradeRecord extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;
  studentId: Types.ObjectId;
  classId: Types.ObjectId;
  teacherId: Types.ObjectId;
  academicPeriod: string;
  attendanceSummary?: IGradeAttendanceSummary;
  homeworkScores: IHomeworkScore[];
  assignmentAvg?: number;
  testScores: ITestScore[];
  examScores: IExamScore[];
  /** Weighted sum: sum(score * weight) */
  finalScore?: number;
  regularComment?: string;
  teacherComment?: string;
  courseComment?: string;
  sessionComments: ISessionComment[];
  monthlyComments: IMonthlyComment[];
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

const GradeAttendanceSummarySchema = new Schema<IGradeAttendanceSummary>(
  {
    totalSessions:   { type: Number, default: 0 },
    presentCount:    { type: Number, default: 0 },
    absentCount:     { type: Number, default: 0 },
    attendanceRate:  { type: Number, default: 0 },
    note:            { type: String, default: null },
  },
  { _id: false }
);

const HomeworkScoreSchema = new Schema<IHomeworkScore>(
  {
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', default: null },
    title:        { type: String, required: true },
    score:        { type: Number, default: null },
    maxScore:     { type: Number, default: null },
    weight:       { type: Number, default: null },
    dueDate:      { type: Date, default: null },
    submittedAt:  { type: Date, default: null },
    feedback:     { type: String, default: null },
  },
  { _id: true }
);

const TestScoreSchema = new Schema<ITestScore>(
  {
    examId:     { type: Schema.Types.ObjectId, ref: 'Exam', default: null },
    title:      { type: String, required: true },
    score:      { type: Number, required: true },
    totalScore: { type: Number, required: true },
    weight:     { type: Number, default: null },
    testDate:   { type: Date, default: null },
    note:       { type: String, default: null },
  },
  { _id: true }
);

const SessionCommentSchema = new Schema<ISessionComment>(
  {
    sessionId:        { type: Schema.Types.ObjectId, ref: 'ClassSession', default: null },
    sessionDate:      { type: Date, required: true },
    topic:            { type: String, default: null },
    attendanceStatus: { type: String, default: null },
    attitudeScore:    { type: Number, default: null },
    comment:          { type: String, required: true },
  },
  { _id: true }
);

const MonthlyCommentSchema = new Schema<IMonthlyComment>(
  {
    month:        { type: String, required: true },
    comment:      { type: String, required: true },
    strengths:    { type: String, default: null },
    improvements: { type: String, default: null },
  },
  { _id: true }
);

const GradeRecordSchema = new Schema<IGradeRecord>(
  {
    schemaVersion:  { type: Number, default: 1 },
    branchId:       { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    studentId:      { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    classId:        { type: Schema.Types.ObjectId, ref: 'Class',  required: true },
    teacherId:      { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    academicPeriod: { type: String, required: true },
    attendanceSummary: { type: GradeAttendanceSummarySchema, default: null },
    homeworkScores: { type: [HomeworkScoreSchema], default: [] },
    assignmentAvg:  { type: Number, default: null },
    testScores:     { type: [TestScoreSchema], default: [] },
    examScores:     { type: [ExamScoreSchema], default: [] },
    finalScore:     { type: Number, default: null },
    regularComment: { type: String, default: null },
    teacherComment: { type: String, default: null },
    courseComment:  { type: String, default: null },
    sessionComments: { type: [SessionCommentSchema], default: [] },
    monthlyComments: { type: [MonthlyCommentSchema], default: [] },
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
