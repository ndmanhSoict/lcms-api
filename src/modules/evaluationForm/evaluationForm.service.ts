import { Types } from 'mongoose';
import { EvaluationFormRepository } from './evaluationForm.repository.js';
import type { IClass } from '../../models/class.model.js';
import type { IClassSession } from '../../models/classSession.model.js';
import type { IEvaluationCriteria, IEvaluationForm } from '../../models/evaluationForm.model.js';
import type { IUser } from '../../models/user.model.js';
import {
  EVALUATION_PERIOD_TYPES,
  EVALUATION_STATUSES,
  EvaluationPeriodType,
  ROLES,
} from '../../shared/constants/roles.js';
import {
  getRelatedParentIds,
  NOTIFICATION_TYPES,
  sendNotifications,
} from '../../shared/utils/notification.helper.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/AllErrors.js';

type EvaluationPayload = AppPayload & {
  student_id: string;
  class_id: string;
  session_id?: string;
  period_type: string;
  period_label?: string;
  month?: string;
  title: string;
  content: string;
  strengths?: string;
  improvements?: string;
  recommendations?: string;
  attitude_score?: number;
  study_score?: number;
  homework_score?: number;
  criteria?: Array<Partial<IEvaluationCriteria> & { max_score?: number }>;
  status?: string;
  publish?: boolean;
};

export class EvaluationFormService {
  private repo: EvaluationFormRepository;

  constructor() {
    this.repo = new EvaluationFormRepository();
  }

  private isManagementRole(role: string) {
    const managementRoles: string[] = [ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF];
    return managementRoles.includes(role);
  }

  private isCreatorRole(role: string) {
    return this.isManagementRole(role) || role === ROLES.TEACHER;
  }

  private assertBranchScope(branchId: Types.ObjectId, requester: RequestUser) {
    if (requester.role !== ROLES.SYSTEM_OWNER && branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Dữ liệu không thuộc cơ sở của bạn');
    }
  }

  private assertTeacherClass(cls: IClass, requester: RequestUser) {
    if (requester.role !== ROLES.TEACHER) return;
    if (cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }
  }

  private assertPeriodAllowed(periodType: string, requester: RequestUser) {
    if (!this.isCreatorRole(requester.role)) {
      throw new ForbiddenError('Bạn không có quyền tạo phiếu đánh giá');
    }
    if (this.isManagementRole(requester.role) && periodType === EVALUATION_PERIOD_TYPES.SESSION) {
      throw new ForbiddenError('Chủ cơ sở và nhân viên chỉ tạo phiếu đánh giá tháng hoặc khóa học');
    }
  }

  private async resolveCreateContext(body: EvaluationPayload, requester: RequestUser) {
    this.assertPeriodAllowed(body.period_type, requester);

    const [cls, student] = await Promise.all([
      this.repo.findClassById(body.class_id) as Promise<IClass | null>,
      this.repo.findStudentById(body.student_id) as Promise<IUser | null>,
    ]);
    if (!cls) throw new NotFoundError('Lớp học');
    if (!student || student.role !== ROLES.STUDENT) throw new NotFoundError('Học sinh');

    this.assertBranchScope(cls.branchId, requester);
    this.assertTeacherClass(cls, requester);

    if (student.branchId?.toString() !== cls.branchId.toString()) {
      throw new ForbiddenError('Học sinh không thuộc cơ sở của lớp học');
    }

    const enrollment = await this.repo.findActiveEnrollment(body.student_id, body.class_id);
    if (!enrollment) {
      throw new BadRequestError('Học sinh chưa được xếp vào lớp học này');
    }

    let session: IClassSession | null = null;
    if (body.period_type === EVALUATION_PERIOD_TYPES.SESSION) {
      if (!body.session_id) throw new BadRequestError('Phiếu theo buổi cần session_id');
      session = (await this.repo.findSessionById(body.session_id)) as IClassSession | null;
      if (!session) throw new NotFoundError('Buổi học');
      if (session.classId.toString() !== cls._id.toString()) {
        throw new BadRequestError('Buổi học không thuộc lớp đã chọn');
      }
      if (session.branchId.toString() !== cls.branchId.toString()) {
        throw new ForbiddenError('Buổi học không thuộc cơ sở của lớp đã chọn');
      }
      if (requester.role === ROLES.TEACHER && session.teacherId?.toString() !== requester.id) {
        throw new ForbiddenError('Bạn không được phân công giảng dạy buổi học này');
      }
    }

    return { cls, student, session };
  }

  private buildPeriodLabel(body: EvaluationPayload, session: IClassSession | null) {
    if (body.period_label?.trim()) return body.period_label.trim();
    if (body.period_type === EVALUATION_PERIOD_TYPES.MONTHLY) {
      return body.month ? `Tháng ${body.month}` : 'Đánh giá tháng';
    }
    if (body.period_type === EVALUATION_PERIOD_TYPES.COURSE) return 'Đánh giá khóa học';
    if (session) return `Buổi ${session.sessionDate.toLocaleDateString('vi-VN')}`;
    return 'Đánh giá buổi học';
  }

  private mapCriteria(criteria: EvaluationPayload['criteria'] = []) {
    return criteria
      .filter(item => item.label?.trim())
      .map(item => ({
        label: item.label?.trim() ?? '',
        score: item.score,
        maxScore: item.max_score ?? item.maxScore,
        comment: item.comment?.trim() || undefined,
      }));
  }

  private async sendPublishedNotifications(evaluation: IEvaluationForm, className: string) {
    const studentId = evaluation.studentId.toString();
    const parentIds = await getRelatedParentIds([studentId]);
    const periodLabel = evaluation.periodLabel;
    const basePayload = {
      branchId: evaluation.branchId,
      type: NOTIFICATION_TYPES.STUDENT_EVALUATION,
      title: `Phiếu đánh giá mới: ${className}`,
      content: `Học sinh có phiếu đánh giá ${periodLabel} của lớp ${className}.`,
      metadata: {
        evaluationId: evaluation._id.toString(),
        classId: evaluation.classId.toString(),
        studentId,
        periodType: evaluation.periodType,
      },
      excludeUserIds: [evaluation.createdBy.toString()],
    };

    await sendNotifications([studentId], {
      ...basePayload,
      actionUrl: '/student/evaluations',
    });
    await sendNotifications(parentIds, {
      ...basePayload,
      actionUrl: '/parent/evaluations',
    });
  }

  async createEvaluation(body: EvaluationPayload, requester: RequestUser) {
    const { cls, session } = await this.resolveCreateContext(body, requester);
    const shouldPublish = body.publish ?? body.status !== EVALUATION_STATUSES.DRAFT;
    const status = shouldPublish ? EVALUATION_STATUSES.PUBLISHED : EVALUATION_STATUSES.DRAFT;

    const evaluation = await this.repo.create({
      branchId: cls.branchId,
      studentId: new Types.ObjectId(body.student_id),
      classId: new Types.ObjectId(body.class_id),
      sessionId: body.session_id ? new Types.ObjectId(body.session_id) : undefined,
      teacherId:
        requester.role === ROLES.TEACHER
          ? new Types.ObjectId(requester.id)
          : (cls.teacherId ?? undefined),
      createdBy: new Types.ObjectId(requester.id),
      createdByRole: requester.role,
      periodType: body.period_type as EvaluationPeriodType,
      periodLabel: this.buildPeriodLabel(body, session),
      month: body.month,
      title: body.title.trim(),
      content: body.content.trim(),
      strengths: body.strengths?.trim() || undefined,
      improvements: body.improvements?.trim() || undefined,
      recommendations: body.recommendations?.trim() || undefined,
      attitudeScore: body.attitude_score,
      studyScore: body.study_score,
      homeworkScore: body.homework_score,
      criteria: this.mapCriteria(body.criteria),
      status,
      publishedAt: status === EVALUATION_STATUSES.PUBLISHED ? new Date() : undefined,
    });

    if (status === EVALUATION_STATUSES.PUBLISHED) {
      await this.sendPublishedNotifications(evaluation, cls.name);
    }

    return evaluation.toObject();
  }

  async publishEvaluation(id: string, requester: RequestUser) {
    const evaluation = await this.repo.findById(id);
    if (!evaluation) throw new NotFoundError('Phiếu đánh giá');

    const cls = (await this.repo.findClassById(evaluation.classId.toString())) as IClass | null;
    if (!cls) throw new NotFoundError('Lớp học');
    this.assertBranchScope(evaluation.branchId, requester);
    this.assertTeacherClass(cls, requester);

    if (!this.isCreatorRole(requester.role)) {
      throw new ForbiddenError('Bạn không có quyền công bố phiếu đánh giá');
    }
    if (evaluation.status === EVALUATION_STATUSES.PUBLISHED) {
      throw new BadRequestError('Phiếu đánh giá này đã được công bố');
    }

    evaluation.status = EVALUATION_STATUSES.PUBLISHED;
    evaluation.publishedAt = new Date();
    await evaluation.save();
    await this.sendPublishedNotifications(evaluation, cls.name);

    return evaluation.toObject();
  }

  async listEvaluations(query: AppQuery, requester: RequestUser) {
    const filter: MongoFilter<IEvaluationForm> = {};
    if (query.student_id) filter.studentId = new Types.ObjectId(query.student_id);
    if (query.class_id) filter.classId = new Types.ObjectId(query.class_id);
    if (query.period_type) filter.periodType = query.period_type;
    if (query.status) filter.status = query.status;

    if (this.isManagementRole(requester.role)) {
      if (requester.role !== ROLES.SYSTEM_OWNER) {
        filter.branchId = new Types.ObjectId(requester.branchId);
      }
    } else if (requester.role === ROLES.TEACHER) {
      filter.branchId = new Types.ObjectId(requester.branchId);
      filter.teacherId = new Types.ObjectId(requester.id);
    } else if (requester.role === ROLES.STUDENT) {
      filter.branchId = new Types.ObjectId(requester.branchId);
      filter.studentId = new Types.ObjectId(requester.id);
      filter.status = EVALUATION_STATUSES.PUBLISHED;
    } else {
      throw new ForbiddenError('Bạn không có quyền xem danh sách phiếu đánh giá này');
    }

    return await this.repo.findMany(filter);
  }

  async getStudentEvaluations(studentId: string, query: AppQuery, requester: RequestUser) {
    const student = (await this.repo.findStudentById(studentId)) as IUser | null;
    if (!student || student.role !== ROLES.STUDENT) throw new NotFoundError('Học sinh');

    const isSelf = requester.role === ROLES.STUDENT && requester.id === studentId;
    const isParent =
      requester.role === ROLES.PARENT &&
      student.branchId?.toString() === requester.branchId?.toString() &&
      student.studentInfo?.parentIds?.map(String).includes(requester.id);
    const isStaff =
      this.isManagementRole(requester.role) &&
      (requester.role === ROLES.SYSTEM_OWNER ||
        student.branchId?.toString() === requester.branchId);
    const isTeacher =
      requester.role === ROLES.TEACHER &&
      student.branchId?.toString() === requester.branchId?.toString();

    if (!isSelf && !isParent && !isStaff && !isTeacher) {
      throw new ForbiddenError('Không có quyền xem phiếu đánh giá của học sinh này');
    }

    const filter: MongoFilter<IEvaluationForm> = {
      branchId: student.branchId,
      studentId: new Types.ObjectId(studentId),
    };
    if (query.class_id) filter.classId = new Types.ObjectId(query.class_id);
    if (query.period_type) filter.periodType = query.period_type;

    if (isSelf || isParent) filter.status = EVALUATION_STATUSES.PUBLISHED;
    if (isTeacher) filter.teacherId = new Types.ObjectId(requester.id);

    return await this.repo.findMany(filter);
  }

  async getClassEvaluations(classId: string, query: AppQuery, requester: RequestUser) {
    const cls = (await this.repo.findClassById(classId)) as IClass | null;
    if (!cls) throw new NotFoundError('Lớp học');
    this.assertBranchScope(cls.branchId, requester);

    if (requester.role === ROLES.TEACHER) {
      this.assertTeacherClass(cls, requester);
    } else if (!this.isManagementRole(requester.role)) {
      throw new ForbiddenError('Bạn không có quyền xem phiếu đánh giá của lớp này');
    }

    const filter: MongoFilter<IEvaluationForm> = {
      branchId: cls.branchId,
      classId: new Types.ObjectId(classId),
    };
    if (query.student_id) filter.studentId = new Types.ObjectId(query.student_id);
    if (query.period_type) filter.periodType = query.period_type;
    if (query.status) filter.status = query.status;

    return await this.repo.findMany(filter);
  }
}
