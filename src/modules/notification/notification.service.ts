import { NotificationRepository } from './notification.repository.js';
import { getPagination, getPaginationMeta } from '../../shared/constants/pagination.helper.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors/AllErrors.js';
import {
  emitNotificationRead,
  emitNotificationsReadAll,
  emitNotificationUnreadCount,
} from '../../infrastructure/socket.js';
import { ROLES } from '../../shared/constants/roles.js';
import { Types } from 'mongoose';

export class NotificationService {
  private repo: NotificationRepository;

  constructor() {
    this.repo = new NotificationRepository();
  }

  // 13.1 Lấy danh sách thông báo của user hiện tại
  async getNotifications(query: AppQuery, requester: RequestUser) {
    if (requester.role !== ROLES.SYSTEM_OWNER && !requester.branchId) {
      throw new ForbiddenError('Tài khoản hiện tại chưa được gán cơ sở');
    }
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: Record<string, unknown> = {};

    if (query.is_read === 'false' || query.is_read === false) filter.isRead = false;
    if (query.is_read === 'true' || query.is_read === true) filter.isRead = true;
    if (query.type) filter.type = query.type;
    if (requester.role !== ROLES.SYSTEM_OWNER) {
      filter.$or = [{ branchId: new Types.ObjectId(requester.branchId) }, { branchId: null }];
    }

    const { items, total, unreadCount } = await this.repo.findByRecipient(
      requester.id,
      filter,
      skip,
      limit
    );

    const data = items.map(n => ({
      _id: n._id,
      type: n.type,
      title: n.title,
      content: n.content,
      action_url: n.actionUrl,
      is_read: n.isRead,
      created_at: n.createdAt,
    }));

    return {
      data,
      meta: { ...getPaginationMeta(total, page, limit), unread: unreadCount },
    };
  }

  // 13.2 Đánh dấu 1 thông báo đã đọc
  async markAsRead(id: string, requester: RequestUser) {
    if (requester.role !== ROLES.SYSTEM_OWNER && !requester.branchId) {
      throw new ForbiddenError('Tài khoản hiện tại chưa được gán cơ sở');
    }
    const scope =
      requester.role === ROLES.SYSTEM_OWNER
        ? {}
        : {
            $or: [{ branchId: new Types.ObjectId(requester.branchId) }, { branchId: null }],
          };
    const notification = await this.repo.findByIdAndRecipient(id, requester.id, scope);
    if (!notification) throw new NotFoundError('Thông báo');
    if (notification.isRead) throw new BadRequestError('Thông báo đã được đọc rồi');

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
    const unreadCount = await this.repo.countUnread(requester.id, scope);

    emitNotificationRead(requester.id, {
      id,
      is_read: true,
      read_at: notification.readAt,
      unread_count: unreadCount,
    });
    emitNotificationUnreadCount(requester.id, unreadCount);

    return { is_read: true, read_at: notification.readAt };
  }

  // 13.3 Đánh dấu tất cả đã đọc
  async markAllAsRead(requester: RequestUser) {
    if (requester.role !== ROLES.SYSTEM_OWNER && !requester.branchId) {
      throw new ForbiddenError('Tài khoản hiện tại chưa được gán cơ sở');
    }
    const scope =
      requester.role === ROLES.SYSTEM_OWNER
        ? {}
        : {
            $or: [{ branchId: new Types.ObjectId(requester.branchId) }, { branchId: null }],
          };
    const updatedCount = await this.repo.markAllAsRead(requester.id, scope);
    emitNotificationsReadAll(requester.id, { updated_count: updatedCount, unread_count: 0 });
    emitNotificationUnreadCount(requester.id, 0);
    return { updated_count: updatedCount };
  }
}
