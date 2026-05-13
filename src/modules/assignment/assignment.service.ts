import { Types } from 'mongoose';
import { AssignmentRepository } from './assignment.repository.js';
import { ROLES } from '../../shared/constants/roles.js';
import { getPagination, getPaginationMeta } from '../../shared/constants/pagination.helper.js';
import {
  getClassAudienceRecipientIds,
  NOTIFICATION_TYPES,
  sendNotifications,
} from '../../shared/utils/notification.helper.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
  ValidationError,
} from '../../shared/errors/AllErrors.js';

export class AssignmentService {
  private repo: AssignmentRepository;

  constructor() {
    this.repo = new AssignmentRepository();
  }

  // Lấy class + kiểm tra GV của lớp
  private async resolveClassAsTeacher(classId: string, requester: any) {
    const cls = await this.repo.findClassById(classId);
    if (!cls) throw new NotFoundError('Lớp học');

    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }
    if (cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }
    return cls;
  }

  // Kiểm tra quyền xem bài tập của lớp (TC, SD, PR, SO/BO/ST)
  private async checkClassReadAccess(classId: string, requester: any) {
    const cls = await this.repo.findClassById(classId);
    if (!cls) throw new NotFoundError('Lớp học');

    const role = requester.role;

    if (role === ROLES.SYSTEM_OWNER) return cls;

    if (cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }

    if ([ROLES.BRANCH_OWNER, ROLES.STAFF].includes(role)) return cls;

    if (role === ROLES.TEACHER) {
      if (cls.teacherId?.toString() !== requester.id) {
        throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
      }
      return cls;
    }

    if (role === ROLES.STUDENT) {
      const enrollment = await this.repo.findActiveEnrollment(requester.id, classId);
      if (!enrollment) throw new ForbiddenError('Bạn không đang học trong lớp này');
      return cls;
    }

    if (role === ROLES.PARENT) {
      const { User } = await import('../../models/user.model.js');
      const parent = await User.findById(requester.id).lean();
      const childIds = parent?.parentInfo?.studentIds?.map(String) ?? [];
      if (childIds.length === 0) throw new ForbiddenError('Bạn không có học sinh trong lớp này');

      const enrollment = await this.repo.findChildEnrollmentInClass(childIds, classId);
      if (!enrollment) throw new ForbiddenError('Con bạn không đang học trong lớp này');
      return cls;
    }

    throw new ForbiddenError('Không có quyền xem bài tập của lớp này');
  }

  // 8.1 GV tạo bài tập
  async createAssignment(classId: string, body: any, requester: any) {
    const cls = await this.resolveClassAsTeacher(classId, requester);

    const submissionConfig = body.submission_config
      ? {
          allowLate: body.submission_config.allow_late ?? true,
          allowText: body.submission_config.allow_text ?? true,
          allowFile: body.submission_config.allow_file ?? true,
          allowedFileTypes: body.submission_config.accept_file_types ?? [],
        }
      : undefined;

    const assignment = await this.repo.createAssignment({
      branchId: cls.branchId,
      classId: new Types.ObjectId(classId),
      teacherId: new Types.ObjectId(requester.id),
      title: body.title,
      description: body.description ?? null,
      assignmentType: body.assignment_type,
      dueDate: body.due_date ? new Date(body.due_date) : undefined,
      maxScore: body.max_score ?? null,
      isGraded: body.is_graded ?? true,
      visibleToParent: body.visible_to_parent ?? true,
      attachmentUrls: body.attachment_urls ?? [],
      submissionConfig,
      status: 'active',
      submissionCount: 0,
      gradedCount: 0,
    });

    const recipients = await getClassAudienceRecipientIds(cls, {
      students: true,
      parents: body.visible_to_parent ?? true,
    });
    const dueText = assignment.dueDate
      ? ` Hạn nộp: ${assignment.dueDate.toLocaleDateString('vi-VN')}.`
      : '';
    await sendNotifications(recipients, {
      branchId: cls.branchId,
      type: NOTIFICATION_TYPES.ASSIGNMENT_CREATED,
      title: `Bài tập mới: ${assignment.title}`,
      content: `Lớp ${cls.name} có bài tập mới "${assignment.title}".${dueText}`,
      actionUrl: `/classes/${classId}/assignments`,
      metadata: {
        classId,
        assignmentId: assignment._id.toString(),
        createdBy: requester.id,
        createdByRole: requester.role,
      },
      excludeUserIds: [requester.id],
    });

    return {
      _id: assignment._id,
      class_id: classId,
      title: assignment.title,
      due_date: assignment.dueDate,
      status: assignment.status,
      submission_count: 0,
    };
  }

  // 8.2 Lấy danh sách bài tập
  async getAssignments(classId: string, query: any, requester: any) {
    await this.checkClassReadAccess(classId, requester);

    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;

    const { items, total } = await this.repo.findAssignmentsByClass(classId, filter, skip, limit);

    // Nếu là học sinh, gắn my_submission
    let mySubmissions: Map<string, any> = new Map();
    if (requester.role === ROLES.STUDENT) {
      const { Submission } = await import('../../models/submission.model.js');
      const assignmentIds = items.map(a => a._id);
      const subs = await Submission.find({
        studentId: new Types.ObjectId(requester.id),
        assignmentId: { $in: assignmentIds },
      })
        .select('assignmentId status submittedAt score')
        .lean();

      subs.forEach(s => {
        mySubmissions.set(s.assignmentId.toString(), s);
      });
    }

    const data = items.map(a => {
      const sub = mySubmissions.get(a._id.toString());
      return {
        _id: a._id,
        title: a.title,
        due_date: a.dueDate,
        max_score: a.maxScore,
        status: a.status,
        submission_count: a.submissionCount,
        graded_count: a.gradedCount,
        my_submission: sub
          ? {
              status: sub.status,
              submitted_at: sub.submittedAt,
              score: sub.score ?? null,
            }
          : null,
      };
    });

    return { data, meta: getPaginationMeta(total, page, limit) };
  }

  // 8.3 HS nộp bài
  async submitAssignment(assignmentId: string, body: any, requester: any) {
    const assignment = await this.repo.findAssignmentById(assignmentId);
    if (!assignment) throw new NotFoundError('Bài tập');
    if (assignment.status !== 'active') throw new BadRequestError('Bài tập không còn mở để nộp');

    // Kiểm tra HS đang học trong lớp
    const enrollment = await this.repo.findActiveEnrollment(
      requester.id,
      assignment.classId.toString()
    );
    if (!enrollment) throw new ForbiddenError('Bạn không đang học trong lớp này');

    // Kiểm tra trùng lặp
    const existing = await this.repo.findSubmissionByStudent(assignmentId, requester.id);
    if (existing) throw new ConflictError('Bạn đã nộp bài tập này rồi');

    // Kiểm tra hạn nộp
    const now = new Date();
    const isLate = assignment.dueDate ? now > assignment.dueDate : false;

    if (isLate && assignment.submissionConfig?.allowLate === false) {
      throw new ValidationError('Đã quá hạn nộp bài và bài tập này không cho phép nộp muộn');
    }

    const submission = await this.repo.createSubmission({
      branchId: assignment.branchId,
      assignmentId: new Types.ObjectId(assignmentId),
      studentId: new Types.ObjectId(requester.id),
      classId: assignment.classId,
      contentText: body.content_text ?? null,
      attachmentUrls: body.attachment_urls ?? [],
      submittedAt: now,
      isLate,
      status: 'submitted',
      maxScore: assignment.maxScore ?? null,
    });

    await this.repo.incrementSubmissionCount(assignmentId);

    return {
      _id: submission._id,
      assignment_id: assignmentId,
      student_id: requester.id,
      status: submission.status,
      submitted_at: submission.submittedAt,
      is_late: submission.isLate,
    };
  }

  // 8.4 GV chấm điểm
  async gradeSubmission(submissionId: string, body: any, requester: any) {
    const submission = await this.repo.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundError('Bài nộp');

    if (!['submitted', 'revision_requested'].includes(submission.status)) {
      throw new BadRequestError('Bài nộp không ở trạng thái có thể chấm điểm');
    }

    // Lấy assignment → kiểm tra GV của lớp
    const assignment = await this.repo.findAssignmentById(submission.assignmentId.toString());
    if (!assignment) throw new NotFoundError('Bài tập');

    const cls = await this.repo.findClassById(assignment.classId.toString());
    if (!cls) throw new NotFoundError('Lớp học');

    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }
    if (requester.role === ROLES.TEACHER && cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }

    if (assignment.maxScore != null && body.score > assignment.maxScore) {
      throw new BadRequestError(`Điểm không được vượt quá điểm tối đa (${assignment.maxScore})`);
    }

    const before = { status: submission.status, score: submission.score };

    const updated = await this.repo.updateSubmissionGrade(submission, {
      score: body.score,
      feedback: body.feedback,
      gradedBy: new Types.ObjectId(requester.id),
    });

    await this.repo.incrementGradedCount(submission.assignmentId.toString());

    // Audit log UPDATE_SCORE (ảnh hưởng học phí / học bạ)
    await this.repo.createAuditLog({
      action: 'UPDATE_SCORE',
      actorId: new Types.ObjectId(requester.id),
      actorRole: requester.role,
      branchId: cls.branchId,
      targetId: submission._id as Types.ObjectId,
      before,
      after: { status: 'graded', score: body.score, feedback: body.feedback },
    });

    // Mock notification HS + PH
    console.log(
      `[Notification] Bài tập "${assignment.title}" của HS ${submission.studentId} đã được chấm điểm: ${body.score}`
    );

    return updated;
  }

  // 8.5 GV xem danh sách bài nộp
  async getSubmissions(assignmentId: string, query: any, requester: any) {
    const assignment = await this.repo.findAssignmentById(assignmentId);
    if (!assignment) throw new NotFoundError('Bài tập');

    const cls = await this.repo.findClassById(assignment.classId.toString());
    if (!cls) throw new NotFoundError('Lớp học');

    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }
    if (requester.role === ROLES.TEACHER && cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }

    const submissions = await this.repo.findSubmissionsByAssignment(assignmentId, query.status);
    const counts = await this.repo.countSubmissionsByAssignment(assignmentId);

    const data = submissions.map(s => ({
      _id: s._id,
      student: {
        _id: (s.studentId as any)?._id ?? s.studentId,
        full_name: (s.studentId as any)?.fullName ?? null,
        user_code: (s.studentId as any)?.userCode ?? null,
      },
      status: s.status,
      submitted_at: s.submittedAt,
      is_late: s.isLate,
      score: s.score ?? null,
    }));

    return {
      data,
      meta: counts,
    };
  }
}
