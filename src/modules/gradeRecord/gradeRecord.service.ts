import { Types } from 'mongoose';
import { GradeRecordRepository } from './gradeRecord.repository.js';
import { ROLES } from '../../shared/constants/roles.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/AllErrors.js';

export class GradeRecordService {
  private repo: GradeRecordRepository;

  constructor() {
    this.repo = new GradeRecordRepository();
  }

  private computeFinalScore(examScores: { score: number; weight: number }[]): number {
    const weighted = examScores.reduce((sum, e) => sum + e.score * e.weight, 0);
    return Math.round(weighted * 100) / 100;
  }

  // 11.1 Tạo / cập nhật học bạ (upsert)
  async upsertGradeRecord(body: any, requester: any) {
    const cls = await this.repo.findClassById(body.class_id);
    if (!cls) throw new NotFoundError('Lớp học');

    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }
    if (cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }

    const student = await this.repo.findStudentById(body.student_id);
    if (!student || student.role !== ROLES.STUDENT) throw new NotFoundError('Học sinh');

    const examScores = (body.exam_scores ?? []).map((e: any) => ({
      examId: new Types.ObjectId(e.exam_id),
      title: e.title,
      score: e.score,
      totalScore: e.total_score,
      weight: e.weight,
      examDate: e.exam_date ? new Date(e.exam_date) : null,
    }));

    const finalScore = examScores.length > 0 ? this.computeFinalScore(examScores) : null;

    const record = await this.repo.upsert({
      branchId: cls.branchId,
      studentId: new Types.ObjectId(body.student_id),
      classId: new Types.ObjectId(body.class_id),
      teacherId: new Types.ObjectId(requester.id),
      academicPeriod: body.academic_period,
      assignmentAvg: body.assignment_avg ?? null,
      examScores,
      finalScore,
      teacherComment: body.teacher_comment ?? null,
    } as any);

    return { ...record.toObject(), final_score: finalScore };
  }

  // 11.2 Publish học bạ
  async publishGradeRecord(id: string, requester: any) {
    const record = await this.repo.findGradeRecordById(id);
    if (!record) throw new NotFoundError('Học bạ');

    const cls = await this.repo.findClassById(record.classId.toString());
    if (!cls) throw new NotFoundError('Lớp học');

    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Không thuộc cơ sở của bạn');
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
    console.log(`[Notification] Học bạ kỳ ${record.academicPeriod} của HS ${record.studentId} đã được công bố`);

    return record.toObject();
  }

  // 11.3 Xem học bạ của học sinh
  async getStudentGradeRecords(studentId: string, query: any, requester: any) {
    const student = await this.repo.findStudentById(studentId);
    if (!student || student.role !== ROLES.STUDENT) throw new NotFoundError('Học sinh');

    const isStaff = [ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF, ROLES.TEACHER].includes(requester.role);
    const isSelf = requester.id === studentId;
    const isParent =
      requester.role === ROLES.PARENT &&
      student.studentInfo?.parentIds?.map(String).includes(requester.id);

    if (!isStaff && !isSelf && !isParent) {
      throw new ForbiddenError('Không có quyền xem học bạ của học sinh này');
    }

    // Staff không phải SO thì check branch
    if (isStaff && requester.role !== ROLES.SYSTEM_OWNER && student.branchId?.toString() !== requester.branchId) {
      throw new ForbiddenError('Học sinh không thuộc cơ sở của bạn');
    }

    // SD / PH chỉ xem bản đã published
    const includeUnpublished = isStaff;

    const filter: Record<string, any> = {};
    if (query.class_id) filter.classId = query.class_id;
    if (query.academic_period) filter.academicPeriod = query.academic_period;

    return await this.repo.findByStudent(studentId, filter, includeUnpublished);
  }
}
