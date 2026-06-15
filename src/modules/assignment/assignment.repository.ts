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

  async findAssignmentByIdWithClass(id: string) {
    return await Assignment.findOne({ _id: id, deletedAt: null })
      .populate('classId', 'name classCode subjectName')
      .populate('teacherId', 'fullName branchId')
      .lean();
  }

  async createAssignment(data: Partial<IAssignment>) {
    return await Assignment.create(data);
  }

  async findAssignmentsByClass(
    classId: string,
    branchId: string,
    filter: MongoFilter<IAssignment>,
    skip: number,
    limit: number
  ) {
    const query = { classId, branchId, deletedAt: null, ...filter };
    const [items, total] = await Promise.all([
      Assignment.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Assignment.countDocuments(query),
    ]);
    return { items, total };
  }

  async findActiveEnrollment(studentId: string, classId: string, branchId?: string) {
    return await Enrollment.findOne({
      studentId,
      classId,
      ...(branchId && { branchId }),
      leftAt: null,
    }).lean();
  }

  // Tìm tất cả enrollment active của parent's children trong 1 lớp
  async findChildEnrollmentInClass(childIds: string[], classId: string, branchId?: string) {
    return await Enrollment.findOne({
      studentId: { $in: childIds.map(id => new Types.ObjectId(id)) },
      classId,
      ...(branchId && { branchId }),
      leftAt: null,
    }).lean();
  }

  async findSubmissionByStudent(assignmentId: string, studentId: string, branchId?: string) {
    return await Submission.findOne({
      assignmentId,
      studentId,
      ...(branchId && { branchId }),
    }).lean();
  }

  async findSubmissionByStudentDoc(assignmentId: string, studentId: string) {
    return await Submission.findOne({ assignmentId, studentId });
  }

  async createSubmission(data: Partial<ISubmission>) {
    return await Submission.create(data);
  }

  async resubmitSubmission(
    submissionDoc: ISubmission,
    data: {
      contentText?: string;
      attachmentUrls: string[];
      answers: ISubmission['answers'];
      submittedAt: Date;
      isLate: boolean;
      status: ISubmission['status'];
      score?: number;
      feedback?: string;
      gradedAt?: Date;
      gradedBy?: Types.ObjectId;
      maxScore?: number;
    }
  ) {
    submissionDoc.contentText = data.contentText;
    submissionDoc.attachmentUrls = data.attachmentUrls;
    submissionDoc.answers = data.answers;
    submissionDoc.submittedAt = data.submittedAt;
    submissionDoc.isLate = data.isLate;
    submissionDoc.status = data.status;
    submissionDoc.score = data.score;
    submissionDoc.feedback = data.feedback;
    submissionDoc.feedbackAttachmentUrls = [];
    submissionDoc.gradedAt = data.gradedAt;
    submissionDoc.gradedBy = data.gradedBy;
    submissionDoc.maxScore = data.maxScore;
    submissionDoc.revisionRequested = false;
    submissionDoc.revisionNote = undefined;
    submissionDoc.resubmitCount += 1;
    return await submissionDoc.save();
  }

  async incrementSubmissionCount(assignmentId: string) {
    await Assignment.findByIdAndUpdate(assignmentId, { $inc: { submissionCount: 1 } });
  }

  async findSubmissionById(id: string) {
    return await Submission.findById(id);
  }

  async updateSubmissionGrade(
    submissionDoc: ISubmission,
    data: {
      score: number;
      feedback?: string;
      feedbackAttachmentUrls: string[];
      gradedBy: Types.ObjectId;
    }
  ) {
    submissionDoc.status = 'graded';
    submissionDoc.score = data.score;
    submissionDoc.feedback = data.feedback;
    submissionDoc.feedbackAttachmentUrls = data.feedbackAttachmentUrls;
    submissionDoc.gradedAt = new Date();
    submissionDoc.gradedBy = data.gradedBy;
    return await submissionDoc.save();
  }

  async incrementGradedCount(assignmentId: string) {
    await Assignment.findByIdAndUpdate(assignmentId, { $inc: { gradedCount: 1 } });
  }

  async decrementGradedCount(assignmentId: string) {
    await Assignment.updateOne({ _id: assignmentId }, [
      { $set: { gradedCount: { $max: [0, { $subtract: ['$gradedCount', 1] }] } } },
    ]);
  }

  async releaseAnswers(assignmentId: string, releasedBy: Types.ObjectId) {
    return await Assignment.findOneAndUpdate(
      { _id: assignmentId, deletedAt: null, answersReleasedAt: null },
      { $set: { answersReleasedAt: new Date(), answersReleasedBy: releasedBy } },
      { new: true }
    ).lean();
  }

  async findSubmissionsByAssignment(assignmentId: string, branchId: string, statusFilter?: string) {
    const query: MongoFilter<ISubmission> = { assignmentId, branchId };
    if (statusFilter) query.status = statusFilter;

    return await Submission.find(query)
      .populate({
        path: 'studentId',
        select: 'fullName userCode branchId',
        match: { branchId },
      })
      .sort({ submittedAt: 1 })
      .lean();
  }

  async countSubmissionsByAssignment(assignmentId: string, branchId: string) {
    const [submitted, graded, total] = await Promise.all([
      Submission.countDocuments({ assignmentId, branchId, status: 'submitted' }),
      Submission.countDocuments({ assignmentId, branchId, status: 'graded' }),
      Submission.countDocuments({ assignmentId, branchId }),
    ]);
    return { total, submitted, graded };
  }

  async createAuditLog(data: {
    action: string;
    actorId: Types.ObjectId;
    actorRole: string;
    branchId: Types.ObjectId;
    targetId: Types.ObjectId;
    before: AuditSnapshot;
    after: AuditSnapshot;
  }) {
    return await AuditLog.create({
      ...data,
      targetType: 'Submission',
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    });
  }
}
