import { Types } from 'mongoose';
import { MessageRepository } from './message.repository.js';
import { ROLES } from '../../shared/constants/roles.js';
import { getPagination, getPaginationMeta } from '../../shared/constants/pagination.helper.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/AllErrors.js';

export class MessageService {
  private repo: MessageRepository;

  constructor() {
    this.repo = new MessageRepository();
  }

  // thread_id = sort([id1, id2]).join('_')
  private buildThreadId(id1: string, id2: string): string {
    return [id1, id2].sort().join('_');
  }

  // 14.1 Lấy danh sách conversation
  async getThreads(requester: any) {
    const userId = new Types.ObjectId(requester.id);
    const threads = await this.repo.getThreadsForUser(userId);

    // Populate thông tin của user còn lại
    const otherUserIds = threads.map(t => t.otherUserId);
    const { User } = await import('../../models/user.model.js');
    const users = await User.find({ _id: { $in: otherUserIds } })
      .select('fullName role')
      .lean();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    return threads.map(t => {
      const other = userMap.get(t.otherUserId?.toString() ?? '');
      return {
        thread_id: t._id,
        other_user: other
          ? { _id: other._id, full_name: other.fullName, role: other.role }
          : null,
        last_message: { content: t.lastContent, sent_at: t.lastSentAt },
        unread_count: t.unreadCount,
      };
    });
  }

  // 14.2 Lấy tin nhắn trong conversation
  async getThreadMessages(threadId: string, query: any, requester: any) {
    // Check access: requester phải là 1 trong 2 thành viên thread
    const parts = threadId.split('_');
    if (parts.length !== 2 || !parts.includes(requester.id)) {
      throw new ForbiddenError('Bạn không phải thành viên của cuộc hội thoại này');
    }

    const { page, limit, skip } = getPagination(query.page, query.limit);
    const [messages, total] = await Promise.all([
      this.repo.getThreadMessages(threadId, skip, limit),
      this.repo.countThreadMessages(threadId),
    ]);

    // Đánh dấu tin nhắn đã đọc
    await this.repo.markThreadAsRead(threadId, new Types.ObjectId(requester.id));

    const data = messages.map(m => ({
      _id: m._id,
      sender_id: m.senderId,
      message_type: m.messageType,
      content: m.content,
      is_read: m.isRead,
      sent_at: m.sentAt,
    }));

    return { data, meta: getPaginationMeta(total, page, limit) };
  }

  // 14.3 Gửi tin nhắn
  async sendMessage(body: any, requester: any) {
    const receiver = await this.repo.findUserById(body.receiver_id);
    if (!receiver) throw new NotFoundError('Người nhận');

    // Kiểm tra GV ↔ PH: chỉ nhắn được với nhau nếu có kết nối qua lớp học
    if (requester.role === ROLES.TEACHER) {
      if (receiver.role !== ROLES.PARENT) {
        throw new BadRequestError('GV chỉ có thể nhắn tin với phụ huynh');
      }
      const hasConnection = await this.repo.teacherHasParentConnection(
        requester.id,
        body.receiver_id
      );
      if (!hasConnection) {
        throw new ForbiddenError('Bạn không có học sinh chung với phụ huynh này');
      }
    } else if (requester.role === ROLES.PARENT) {
      if (receiver.role !== ROLES.TEACHER) {
        throw new BadRequestError('Phụ huynh chỉ có thể nhắn tin với giáo viên');
      }
      const hasConnection = await this.repo.parentHasTeacherConnection(
        requester.id,
        body.receiver_id
      );
      if (!hasConnection) {
        throw new ForbiddenError('Con bạn không học lớp của giáo viên này');
      }
    }

    const threadId = this.buildThreadId(requester.id, body.receiver_id);
    const senderId = new Types.ObjectId(requester.id);

    // Xác định branchId từ sender
    const sender = await this.repo.findUserById(requester.id);
    const branchId = sender?.branchId ?? receiver.branchId;
    if (!branchId) throw new BadRequestError('Không xác định được cơ sở');

    const message = await this.repo.createMessage({
      branchId,
      threadId,
      senderId,
      receiverId: new Types.ObjectId(body.receiver_id),
      messageType: body.message_type ?? 'text',
      content: body.content ?? null,
      attachmentUrl: body.attachment_url ?? null,
      isRead: false,
      sentAt: new Date(),
    });

    // Mock: emit socket event
    console.log(`[Socket] message:new:${body.receiver_id}`);

    return {
      _id: message._id,
      thread_id: threadId,
      sender_id: requester.id,
      content: message.content,
      sent_at: message.sentAt,
    };
  }
}
