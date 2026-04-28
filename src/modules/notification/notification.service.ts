import { NotificationRepository } from './notification.repository.js';
import { getPagination, getPaginationMeta } from '../../shared/constants/pagination.helper.js';
import { NotFoundError, BadRequestError } from '../../shared/errors/AllErrors.js';

export class NotificationService {
  private repo: NotificationRepository;

  constructor() {
    this.repo = new NotificationRepository();
  }

  // 13.1 Lấy danh sách thông báo của user hiện tại
  async getNotifications(query: any, requester: any) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: Record<string, any> = {};

    if (query.is_read === 'false' || query.is_read === false) filter.isRead = false;
    if (query.is_read === 'true' || query.is_read === true) filter.isRead = true;
    if (query.type) filter.type = query.type;

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
  async markAsRead(id: string, requester: any) {
    const notification = await this.repo.findByIdAndRecipient(id, requester.id);
    if (!notification) throw new NotFoundError('Thông báo');
    if (notification.isRead) throw new BadRequestError('Thông báo đã được đọc rồi');

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return { is_read: true, read_at: notification.readAt };
  }

  // 13.3 Đánh dấu tất cả đã đọc
  async markAllAsRead(requester: any) {
    const updatedCount = await this.repo.markAllAsRead(requester.id);
    return { updated_count: updatedCount };
  }
}
