import { Types } from 'mongoose';
import { Assignment, IAssignment } from '../../models/assignment.model.js';
import { Submission, ISubmission } from '../../models/submission.model.js';
import { Class } from '../../models/class.model.js';
import { Enrollment } from '../../models/enrollment.model.js';
import { AuditLog } from '../../models/auditLog.model.js';

export class AssignmentRepository {
  async findClassById(classId: string) {
    return await Class.findOne({ _id: classId, deletedAt: null }).lean();
  }

  async findAssignmentById(id: string) {
    return await Assignment.findOne({ _id: id, deletedAt: null }).lean();
  }

  async createAssignment(data: Partial<IAssignment>) {
    return await Assignment.create(data);
  }

  async findAssignmentsByClass(
    classId: string,
    filter: Record<string, any>,
    skip: number,
    limit: number
  ) {
    const query = { classId, deletedAt: null, ...filter };
    const [items, total] = await Promise.all([
      Assignment.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Assignment.countDocuments(query),
    ]);
    return { items, total };
  }

  async findActiveEnrollment(studentId: string, classId: string) {
    return await Enrollment.findOne({ studentId, classId, leftAt: null }).lean();
  }

  // Tìm tất cả enrollment active của parent's children trong 1 lớp
  async findChildEnrollmentInClass(childIds: string[], classId: string) {
    return await Enrollment.findOne({
      studentId: { $in: childIds.map(id => new Types.ObjectId(id)) },
      classId,
      leftAt: null,
    }).lean();
  }

  async findSubmissionByStudent(assignmentId: string, studentId: string) {
    return await Submission.findOne({ assignmentId, studentId }).lean();
  }

  async createSubmission(data: Partial<ISubmission>) {
    return await Submission.create(data);
  }

  async incrementSubmissionCount(assignmentId: string) {
    await Assignment.findByIdAndUpdate(assignmentId, { $inc: { submissionCount: 1 } });
  }

  async findSubmissionById(id: string) {
    return await Submission.findById(id);
  }

  async updateSubmissionGrade(
    submissionDoc: any,
    data: { score: number; feedback?: string; gradedBy: Types.ObjectId }
  ) {
    submissionDoc.status = 'graded';
    submissionDoc.score = data.score;
    submissionDoc.feedback = data.feedback ?? null;
    submissionDoc.gradedAt = new Date();
    submissionDoc.gradedBy = data.gradedBy;
    return await submissionDoc.save();
  }

  async incrementGradedCount(assignmentId: string) {
    await Assignment.findByIdAndUpdate(assignmentId, { $inc: { gradedCount: 1 } });
  }

  async findSubmissionsByAssignment(assignmentId: string, statusFilter?: string) {
    const query: Record<string, any> = { assignmentId };
    if (statusFilter) query.status = statusFilter;

    return await Submission.find(query)
      .populate('studentId', 'fullName userCode')
      .sort({ submittedAt: 1 })
      .lean();
  }

  async countSubmissionsByAssignment(assignmentId: string) {
    const [submitted, graded, total] = await Promise.all([
      Submission.countDocuments({ assignmentId, status: 'submitted' }),
      Submission.countDocuments({ assignmentId, status: 'graded' }),
      Submission.countDocuments({ assignmentId }),
    ]);
    return { total, submitted, graded };
  }

  async createAuditLog(data: {
    action: string;
    actorId: Types.ObjectId;
    actorRole: string;
    branchId: Types.ObjectId;
    targetId: Types.ObjectId;
    before: Record<string, any>;
    after: Record<string, any>;
  }) {
    return await AuditLog.create({
      ...data,
      targetType: 'Submission',
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    });
  }
}
