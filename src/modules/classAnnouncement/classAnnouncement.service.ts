import { Types } from 'mongoose';
import { ClassAnnouncementRepository } from './classAnnouncement.repository.js';
import { ROLES } from '../../shared/constants/roles.js';
import { getPagination, getPaginationMeta } from '../../shared/constants/pagination.helper.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AllErrors.js';

export class ClassAnnouncementService {
  private repo: ClassAnnouncementRepository;

  constructor() {
    this.repo = new ClassAnnouncementRepository();
  }

  private async checkClassAccess(classId: string, requester: RequestUser) {
    const cls = await this.repo.findClassById(classId);
    if (!cls) throw new NotFoundError('Lớp học');

    const role = requester.role;
    if (role === ROLES.SYSTEM_OWNER) return cls;

    if (cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }

    if (([ROLES.BRANCH_OWNER, ROLES.STAFF] as string[]).includes(role)) return cls;

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
      const parent = await this.repo.findParentById(requester.id);
      const childIds = parent?.parentInfo?.studentIds?.map(String) ?? [];
      if (childIds.length === 0) throw new ForbiddenError('Bạn không có học sinh trong lớp này');
      const enrollment = await this.repo.findChildEnrollmentInClass(childIds, classId);
      if (!enrollment) throw new ForbiddenError('Con bạn không đang học trong lớp này');
      return cls;
    }

    throw new ForbiddenError('Không có quyền xem thông báo lớp học');
  }

  // 16.1 Tạo thông báo lớp
  async createAnnouncement(classId: string, body: AppPayload, requester: RequestUser) {
    const cls = await this.repo.findClassById(classId);
    if (!cls) throw new NotFoundError('Lớp học');

    if (requester.role !== ROLES.SYSTEM_OWNER && cls.branchId.toString() !== requester.branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở của bạn');
    }
    if (cls.teacherId?.toString() !== requester.id) {
      throw new ForbiddenError('Bạn không được phân công giảng dạy lớp này');
    }

    const targetAudience = body.target_audience ?? ['student', 'parent'];

    const announcement = await this.repo.create({
      branchId: cls.branchId,
      classId: new Types.ObjectId(classId),
      authorId: new Types.ObjectId(requester.id),
      title: body.title ?? '',
      content: body.content,
      attachmentUrls: body.attachment_urls ?? [],
      isPinned: body.is_pinned ?? false,
      targetAudience,
      notificationSent: true,
      notificationSentAt: new Date(),
    });

    // Mock notification gửi đến đối tượng mục tiêu
    console.log(
      `[Notification] Thông báo mới "${body.title}" cho lớp ${classId} — đối tượng: ${targetAudience.join(', ')}`
    );

    return announcement;
  }

  // 16.2 Lấy danh sách thông báo lớp
  async getAnnouncements(classId: string, query: AppQuery, requester: RequestUser) {
    const cls = await this.checkClassAccess(classId, requester);

    const { page, limit, skip } = getPagination(query.page, query.limit);
    const { items, total } = await this.repo.findByClass(
      classId,
      cls.branchId.toString(),
      skip,
      limit
    );

    return {
      data: items,
      meta: getPaginationMeta(total, page, limit),
    };
  }
}
