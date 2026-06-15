import { Types } from 'mongoose';
import { GradeRecordRepository } from './gradeRecord.repository.js';
import { ROLES } from '../../shared/constants/roles.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/AllErrors.js';
import type { IClass } from '../../models/class.model.js';
import type {
  IExamScore,
  IGradeAttendanceSummary,
  IGradeRecord,
  IHomeworkScore,
  IMonthlyComment,
  ISessionComment,
  ITestScore,
} from '../../models/gradeRecord.model.js';

type ScoreItem = {
  score?: number | null;
  maxScore?: number | null;
  totalScore?: number | null;
  weight?: number | null;
};
type AttendanceSummaryInput = Partial<IGradeAttendanceSummary> & {
  total_sessions?: number;
  present_count?: number;
  absent_count?: number;
  attendance_rate?: number;
};
type HomeworkScoreInput = Partial<IHomeworkScore> & {
  assignment_id?: string | Types.ObjectId;
  max_score?: number;
  due_date?: string | Date;
  submitted_at?: string | Date;
};
type TestScoreInput = Partial<ITestScore> & {
  exam_id?: string | Types.ObjectId;
  total_score?: number;
  test_date?: string | Date;
  exam_date?: string | Date;
  examDate?: Date;
};
type ExamScoreInput = Partial<IExamScore> & {
  exam_id?: string | Types.ObjectId;
  total_score?: number;
  test_date?: string | Date;
  testDate?: Date;
  exam_date?: string | Date;
  examDate?: Date;
  note?: string;
};
type SessionCommentInput = Partial<ISessionComment> & {
  session_id?: string | Types.ObjectId;
  session_date?: string | Date;
  attendance_status?: string;
  attitude_score?: number;
};
type MonthlyCommentInput = Partial<IMonthlyComment>;
type GradeRecordPayload = AppPayload & {
  class_id: string;
  student_id: string;
  academic_period: string;
  attendance_summary?: AttendanceSummaryInput;
  homework_scores?: HomeworkScoreInput[];
  test_scores?: TestScoreInput[];
  exam_scores?: ExamScoreInput[];
  session_comments?: SessionCommentInput[];
  monthly_comments?: MonthlyCommentInput[];
};

export class GradeRecordService {
  private repo: GradeRecordRepository;

  constructor() {
    this.repo = new GradeRecordRepository();
  }

  private roundScore(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private normalizeObjectId(id?: string | Types.ObjectId | null) {
    if (!id) return undefined;
    return id instanceof Types.ObjectId ? id : new Types.ObjectId(id);
  }

  private computeAverage(items: ScoreItem[]): number | null {
    const validItems = items.filter(
      item =>
        typeof item.score === 'number' &&
        item.score >= 0 &&
        typeof (item.maxScore ?? item.totalScore) === 'number' &&
        (item.maxScore ?? item.totalScore ?? 0) > 0
    );

    if (!validItems.length) return null;

    const totalWeight = validItems.reduce((sum, item) => sum + (item.weight ?? 1), 0);
    const weighted = validItems.reduce((sum, item) => {
      const maxScore = item.maxScore ?? item.totalScore ?? 10;
      const normalized = ((item.score ?? 0) / maxScore) * 10;
      return sum + normalized * (item.weight ?? 1);
    }, 0);

    return this.roundScore(weighted / totalWeight);
  }

  private computeFinalScore(homeworkAvg: number | null, testAvg: number | null): number | null {
    if (homeworkAvg === null && testAvg === null) return null;
    if (homeworkAvg === null) return testAvg;
    if (testAvg === null) return homeworkAvg;
    return this.roundScore(homeworkAvg * 0.4 + testAvg * 0.6);
  }

  private mapAttendanceSummary(
    input: AttendanceSummaryInput | undefined,
    fallback: IGradeAttendanceSummary
  ): IGradeAttendanceSummary {
    const totalSessions = input?.total_sessions ?? fallback.totalSessions ?? 0;
    const presentCount = input?.present_count ?? fallback.presentCount ?? 0;
    const absentCount = input?.absent_count ?? fallback.absentCount ?? 0;
    const attendanceRate =
      input?.attendance_rate ??
      fallback.attendanceRate ??
      (totalSessions > 0 ? this.roundScore((presentCount / totalSessions) * 100) : 0);

    return {
      totalSessions,
      presentCount,
      absentCount,
      attendanceRate,
      note: input?.note,
    };
  }

  private mapHomeworkScores(
    input: HomeworkScoreInput[] | undefined,
    fallback: IHomeworkScore[]
  ): IHomeworkScore[] {
    const source: HomeworkScoreInput[] = input ?? fallback.map(item => ({ ...item }));
    return source.map(item => ({
      assignmentId: this.normalizeObjectId(item.assignment_id ?? item.assignmentId?.toString?.()),
      title: item.title ?? 'Bài tập',
      score: item.score ?? undefined,
      maxScore: item.max_score ?? item.maxScore ?? undefined,
      weight: item.weight ?? undefined,
      dueDate: item.due_date ? new Date(item.due_date) : (item.dueDate ?? undefined),
      submittedAt: item.submitted_at
        ? new Date(item.submitted_at)
        : (item.submittedAt ?? undefined),
      feedback: item.feedback ?? undefined,
    }));
  }

  private mapTestScores(
    input: TestScoreInput[] | undefined,
    legacyExamScores: ExamScoreInput[]
  ): ITestScore[] {
    const source = input ?? legacyExamScores;
    return source.map(item => ({
      examId: this.normalizeObjectId(item.exam_id ?? item.examId?.toString?.()),
      title: item.title ?? 'Bài kiểm tra',
      score: item.score ?? 0,
      totalScore: item.total_score ?? item.totalScore ?? 10,
      weight: item.weight ?? undefined,
      testDate: item.test_date
        ? new Date(item.test_date)
        : item.exam_date
          ? new Date(item.exam_date)
          : (item.testDate ?? item.examDate ?? undefined),
      note: item.note ?? undefined,
    }));
  }

  private mapExamScores(input: ExamScoreInput[]): IExamScore[] {
    return input
      .filter(item => item.exam_id || item.examId)
      .map(item => ({
        examId: this.normalizeObjectId(item.exam_id ?? item.examId?.toString?.())!,
        title: item.title ?? 'Bài kiểm tra',
        score: item.score ?? 0,
        totalScore: item.totalScore ?? 10,
        weight: item.weight ?? 0,
        examDate: item.exam_date ? new Date(item.exam_date) : (item.examDate ?? undefined),
      }));
  }

  private mapSessionComments(input: SessionCommentInput[] | undefined): ISessionComment[] {
    return (input ?? []).map(item => ({
      sessionId: this.normalizeObjectId(item.session_id ?? item.sessionId?.toString?.()),
      sessionDate: new Date(item.session_date ?? item.sessionDate ?? new Date()),
      topic: item.topic ?? undefined,
      attendanceStatus: item.attendance_status ?? item.attendanceStatus ?? undefined,
      attitudeScore: item.attitude_score ?? item.attitudeScore ?? undefined,
      comment: item.comment ?? '',
    }));
  }

  private mapMonthlyComments(input: MonthlyCommentInput[] | undefined): IMonthlyComment[] {
    return (input ?? []).map(item => ({
      month: item.month ?? '',
      comment: item.comment ?? '',
      strengths: item.strengths ?? undefined,
      improvements: item.improvements ?? undefined,
    }));
  }

  private isStaffRole(role: string): boolean {
    const staffRoles: string[] = [
      ROLES.SYSTEM_OWNER,
      ROLES.BRANCH_OWNER,
      ROLES.STAFF,
      ROLES.TEACHER,
    ];
    return staffRoles.includes(role);
  }

  private assertCanReadClass(cls: IClass, requester: RequestUser) {
    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }
    if (requester.role === ROLES.TEACHER && cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }
  }

  // 11.1 Tạo / cập nhật học bạ (upsert)
  async upsertGradeRecord(body: GradeRecordPayload, requester: RequestUser) {
    if (!body.class_id || !body.student_id || !body.academic_period) {
      throw new BadRequestError('Thiếu lớp, học sinh hoặc kỳ học');
    }

    const cls = (await this.repo.findClassById(body.class_id)) as IClass | null;
    if (!cls) throw new NotFoundError('Lớp học');

    this.assertCanReadClass(cls, requester);
    if (cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }

    const student = await this.repo.findStudentById(body.student_id);
    if (!student || student.role !== ROLES.STUDENT) throw new NotFoundError('Học sinh');
    if (student.branchId?.toString() !== cls.branchId.toString()) {
      throw new ForbiddenError('Học sinh không thuộc cơ sở của lớp học');
    }
    const enrollment = await this.repo.findActiveEnrollment(body.student_id, body.class_id);
    if (!enrollment) {
      throw new BadRequestError('Học sinh chưa được xếp vào lớp học này');
    }

    const attendanceFallback = await this.repo.getAttendanceSummary(body.student_id, body.class_id);
    const homeworkFallback = await this.repo.getHomeworkScores(body.student_id, body.class_id);
    const homeworkScores = this.mapHomeworkScores(body.homework_scores, homeworkFallback);
    const legacyExamScores = body.exam_scores ?? [];
    const testScores = this.mapTestScores(body.test_scores, legacyExamScores);
    const assignmentAvg =
      (typeof body.assignment_avg === 'number'
        ? body.assignment_avg
        : this.computeAverage(homeworkScores)) ?? undefined;
    const testAvg = this.computeAverage(testScores);
    const finalScore = this.computeFinalScore(assignmentAvg ?? null, testAvg) ?? undefined;

    const recordData: Partial<IGradeRecord> & {
      studentId: Types.ObjectId;
      classId: Types.ObjectId;
      academicPeriod: string;
    } = {
      branchId: cls.branchId,
      studentId: new Types.ObjectId(body.student_id),
      classId: new Types.ObjectId(body.class_id),
      teacherId: new Types.ObjectId(requester.id),
      academicPeriod: body.academic_period,
      attendanceSummary: this.mapAttendanceSummary(body.attendance_summary, attendanceFallback),
      homeworkScores,
      assignmentAvg,
      testScores,
      examScores: this.mapExamScores(legacyExamScores),
      finalScore,
      regularComment: body.regular_comment ?? undefined,
      teacherComment: body.teacher_comment ?? undefined,
      courseComment: body.course_comment ?? undefined,
      sessionComments: this.mapSessionComments(body.session_comments),
      monthlyComments: this.mapMonthlyComments(body.monthly_comments),
      status: 'draft',
      publishedAt: undefined,
    };

    const record = await this.repo.upsert(recordData);

    return { ...record?.toObject(), final_score: finalScore };
  }

  // 11.2 Publish học bạ
  async publishGradeRecord(id: string, requester: RequestUser) {
    const record = await this.repo.findGradeRecordById(id);
    if (!record) throw new NotFoundError('Học bạ');

    const cls = (await this.repo.findClassById(record.classId.toString())) as IClass | null;
    if (!cls) throw new NotFoundError('Lớp học');

    this.assertCanReadClass(cls, requester);
    if (record.branchId.toString() !== cls.branchId.toString()) {
      throw new ForbiddenError('Học bạ không thuộc cơ sở của lớp học');
    }
    if (cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }
    if (record.status === 'published') {
      throw new BadRequestError('Học bạ này đã được publish rồi');
    }

    record.status = 'published';
    record.publishedAt = new Date();
    await record.save();

    // Mock notification cho HS + PH
    console.log(
      `[Notification] Học bạ kỳ ${record.academicPeriod} của HS ${record.studentId} đã được công bố`
    );

    return record.toObject();
  }

  // 11.3 Xem học bạ của học sinh
  async getStudentGradeRecords(studentId: string, query: AppQuery, requester: RequestUser) {
    const student = await this.repo.findStudentById(studentId);
    if (!student || student.role !== ROLES.STUDENT) throw new NotFoundError('Học sinh');

    const isStaff = this.isStaffRole(requester.role);
    const isSelf = requester.id === studentId;
    const isParent =
      requester.role === ROLES.PARENT &&
      student.branchId?.toString() === requester.branchId?.toString() &&
      student.studentInfo?.parentIds?.map(String).includes(requester.id);

    if (!isStaff && !isSelf && !isParent) {
      throw new ForbiddenError('Không có quyền xem học bạ của học sinh này');
    }

    // Staff không phải SO thì check branch
    if (
      isStaff &&
      requester.role !== ROLES.SYSTEM_OWNER &&
      student.branchId?.toString() !== requester.branchId
    ) {
      throw new ForbiddenError('Học sinh không thuộc cơ sở của bạn');
    }

    // SD / PH chỉ xem bản đã published
    const includeUnpublished = isStaff;

    const filter: MongoFilter<IGradeRecord> = { branchId: student.branchId };
    if (query.class_id) {
      const cls = (await this.repo.findClassById(query.class_id)) as IClass | null;
      if (!cls || cls.branchId.toString() !== student.branchId?.toString()) {
        throw new ForbiddenError('Lớp học không thuộc cơ sở của học sinh');
      }
      this.assertCanReadClass(cls, requester);
      filter.classId = new Types.ObjectId(query.class_id);
    }
    if (query.academic_period) filter.academicPeriod = query.academic_period;

    return await this.repo.findByStudent(studentId, filter, includeUnpublished);
  }

  // 11.4 Xem học bạ theo lớp
  async getClassGradeRecords(classId: string, query: AppQuery, requester: RequestUser) {
    const cls = (await this.repo.findClassById(classId)) as IClass | null;
    if (!cls) throw new NotFoundError('Lớp học');

    this.assertCanReadClass(cls, requester);

    const includeUnpublished =
      query.include_unpublished === 'true' || this.isStaffRole(requester.role);

    const filter: MongoFilter<IGradeRecord> = { branchId: cls.branchId };
    if (query.academic_period) filter.academicPeriod = query.academic_period;

    return await this.repo.findByClass(classId, filter, includeUnpublished);
  }
}
