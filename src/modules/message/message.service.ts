import { Types } from 'mongoose';
import { MessageRepository } from './message.repository.js';
import { ROLES } from '../../shared/constants/roles.js';
import { getPagination, getPaginationMeta } from '../../shared/constants/pagination.helper.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors/AllErrors.js';
import {
  emitMessageCreated,
  emitMessagesRead,
  emitMessageUnreadCount,
} from '../../infrastructure/socket.js';
import type { IMessage } from '../../models/message.model.js';
import type { IUser } from '../../models/user.model.js';

type MessageUserView = Pick<
  IUser,
  | '_id'
  | 'fullName'
  | 'role'
  | 'userCode'
  | 'email'
  | 'avatarUrl'
  | 'branchId'
  | 'isActive'
  | 'deletedAt'
>;
type MessageView = Pick<
  IMessage,
  | '_id'
  | 'branchId'
  | 'threadId'
  | 'senderId'
  | 'receiverId'
  | 'messageType'
  | 'content'
  | 'attachmentUrl'
  | 'isRead'
  | 'sentAt'
>;
type SendMessagePayload = AppPayload & {
  receiver_id: string;
};

export class MessageService {
  private repo: MessageRepository;

  constructor() {
    this.repo = new MessageRepository();
  }

  private buildThreadId(id1: string, id2: string): string {
    return [id1, id2].sort().join('_');
  }

  private serializeUser(user: MessageUserView) {
    return {
      _id: user._id,
      id: user._id?.toString?.() ?? String(user._id ?? ''),
      full_name: user.fullName,
      fullName: user.fullName,
      role: user.role,
      user_code: user.userCode ?? null,
      userCode: user.userCode ?? null,
      email: user.email ?? '',
      avatar_url: user.avatarUrl ?? null,
      avatarUrl: user.avatarUrl ?? null,
      branch_id: user.branchId?.toString?.() ?? null,
      branchId: user.branchId?.toString?.() ?? null,
    };
  }

  private serializeMessage(message: MessageView) {
    const sentAt = message.sentAt instanceof Date ? message.sentAt.toISOString() : message.sentAt;
    return {
      _id: message._id,
      id: message._id?.toString?.() ?? String(message._id ?? ''),
      thread_id: message.threadId,
      threadId: message.threadId,
      sender_id: message.senderId?.toString?.() ?? String(message.senderId ?? ''),
      senderId: message.senderId?.toString?.() ?? String(message.senderId ?? ''),
      receiver_id: message.receiverId?.toString?.() ?? String(message.receiverId ?? ''),
      receiverId: message.receiverId?.toString?.() ?? String(message.receiverId ?? ''),
      message_type: message.messageType,
      messageType: message.messageType,
      content: message.content ?? '',
      attachment_url: message.attachmentUrl ?? '',
      attachmentUrl: message.attachmentUrl ?? '',
      is_read: Boolean(message.isRead),
      isRead: Boolean(message.isRead),
      sent_at: sentAt,
      sentAt,
    };
  }

  private async getRequesterBranchIds(requester: RequestUser) {
    if (requester.branchId) return [String(requester.branchId)];
    if (requester.role === ROLES.PARENT) {
      return await this.repo.getBranchIdsForParent(requester.id);
    }

    const requesterDoc = await this.repo.findUserById(requester.id);
    return requesterDoc?.branchId ? [requesterDoc.branchId.toString()] : [];
  }

  private async canMessageUser(requester: RequestUser, receiver: MessageUserView) {
    if (requester.id === receiver._id.toString()) return false;
    if (requester.role === ROLES.SYSTEM_OWNER || receiver.role === ROLES.SYSTEM_OWNER) return true;

    const branchIds = await this.getRequesterBranchIds(requester);
    if (receiver.branchId && branchIds.includes(receiver.branchId.toString())) return true;

    return false;
  }

  private async getAllowedCounterpartyIds(
    userId: string,
    role: string,
    branchId?: Types.ObjectId | string
  ) {
    if (role === ROLES.SYSTEM_OWNER) return undefined;

    const branchIds = branchId
      ? [branchId.toString()]
      : await this.repo.getBranchIdsForParent(userId);
    const users = await this.repo.findUsers(
      {
        _id: { $ne: new Types.ObjectId(userId) },
        isActive: true,
        deletedAt: null,
        $or: [
          { role: ROLES.SYSTEM_OWNER },
          ...(branchIds.length
            ? [{ branchId: { $in: branchIds.map(id => new Types.ObjectId(id)) } }]
            : []),
        ],
      },
      10_000
    );
    return users.map(user => new Types.ObjectId(user._id));
  }

  async getAvailableUsers(query: AppQuery, requester: RequestUser) {
    const limit = Math.min(Number(query.limit ?? 50), 100);
    const filter: Record<string, unknown> = {
      _id: { $ne: new Types.ObjectId(requester.id) },
      isActive: true,
      deletedAt: null,
    };

    if (query.search) {
      filter.fullName = { $regex: String(query.search), $options: 'i' };
    }

    if (query.role) {
      filter.role = query.role;
    }

    if (requester.role !== ROLES.SYSTEM_OWNER) {
      const branchIds = await this.getRequesterBranchIds(requester);
      filter.$or = [
        { role: ROLES.SYSTEM_OWNER },
        ...(branchIds.length
          ? [{ branchId: { $in: branchIds.map(id => new Types.ObjectId(id)) } }]
          : []),
      ];
    }

    const users = await this.repo.findUsers(filter, limit);
    return users.map(user => this.serializeUser(user));
  }

  async getUnreadCount(requester: RequestUser) {
    const senderIds = await this.getAllowedCounterpartyIds(
      requester.id,
      requester.role,
      requester.branchId
    );
    const unreadCount = await this.repo.countUnreadMessages(
      new Types.ObjectId(requester.id),
      senderIds
    );
    return { unread_count: unreadCount, unreadCount };
  }

  async getThreads(requester: RequestUser) {
    const userId = new Types.ObjectId(requester.id);
    const threads = await this.repo.getThreadsForUser(userId);

    const otherUserIds = threads.map(t => t.otherUserId);
    const { User } = await import('../../models/user.model.js');
    const users = await User.find({ _id: { $in: otherUserIds } })
      .select('fullName role userCode email avatarUrl branchId')
      .lean();
    const userMap = new Map(users.map(u => [u._id.toString(), u as MessageUserView]));

    const visibleThreads = [];
    for (const t of threads) {
      const other = userMap.get(t.otherUserId?.toString() ?? '');
      if (!other || !(await this.canMessageUser(requester, other))) continue;
      visibleThreads.push({
        thread_id: t._id,
        threadId: t._id,
        other_user: other ? this.serializeUser(other) : null,
        otherUser: other ? this.serializeUser(other) : null,
        last_message: {
          content: t.lastContent ?? '',
          message_type: t.lastMessageType ?? 'text',
          sent_at: t.lastSentAt,
          sender_id: t.lastSenderId?.toString?.() ?? '',
        },
        lastMessage: {
          content: t.lastContent ?? '',
          messageType: t.lastMessageType ?? 'text',
          sentAt: t.lastSentAt,
          senderId: t.lastSenderId?.toString?.() ?? '',
        },
        unread_count: t.unreadCount,
        unreadCount: t.unreadCount,
      });
    }
    return visibleThreads;
  }

  async getThreadMessages(threadId: string, query: AppQuery, requester: RequestUser) {
    const parts = threadId.split('_');
    if (parts.length !== 2 || !parts.includes(requester.id)) {
      throw new ForbiddenError('Bạn không phải thành viên của cuộc hội thoại này');
    }
    const otherUserId = parts.find(id => id !== requester.id);
    const otherUser = otherUserId
      ? ((await this.repo.findUserById(otherUserId)) as MessageUserView | null)
      : null;
    if (!otherUser || !(await this.canMessageUser(requester, otherUser))) {
      throw new ForbiddenError('Cuộc hội thoại không thuộc phạm vi cơ sở của bạn');
    }

    const { page, limit, skip } = getPagination(query.page, query.limit);
    const [messages, total] = await Promise.all([
      this.repo.getThreadMessages(threadId, skip, limit),
      this.repo.countThreadMessages(threadId),
    ]);

    const readCount = await this.repo.markThreadAsRead(threadId, new Types.ObjectId(requester.id));
    if (readCount > 0) {
      const senderIds = await this.getAllowedCounterpartyIds(
        requester.id,
        requester.role,
        requester.branchId
      );
      const unreadCount = await this.repo.countUnreadMessages(
        new Types.ObjectId(requester.id),
        senderIds
      );
      emitMessagesRead(requester.id, { thread_id: threadId, updated_count: readCount });
      emitMessageUnreadCount(requester.id, unreadCount);
    }

    const data = (messages as MessageView[])
      .reverse()
      .map(message => this.serializeMessage(message));

    return { data, meta: getPaginationMeta(total, page, limit) };
  }

  async sendMessage(body: SendMessagePayload, requester: RequestUser) {
    if (!body.receiver_id) throw new BadRequestError('Thiếu người nhận');

    const receiver = (await this.repo.findUserById(body.receiver_id)) as MessageUserView | null;
    if (!receiver || !receiver.isActive || receiver.deletedAt)
      throw new NotFoundError('Người nhận');

    const allowed = await this.canMessageUser(requester, receiver);
    if (!allowed) {
      throw new ForbiddenError('Bạn không thể nhắn tin với người dùng ngoài phạm vi của mình');
    }

    const threadId = this.buildThreadId(requester.id, body.receiver_id);
    const senderId = new Types.ObjectId(requester.id);
    const sender = (await this.repo.findUserById(requester.id)) as MessageUserView | null;
    if (!sender) throw new BadRequestError('Không xác định được người gửi');

    const message = await this.repo.createMessage({
      branchId: sender.branchId ?? receiver.branchId ?? undefined,
      threadId,
      senderId,
      receiverId: new Types.ObjectId(body.receiver_id),
      messageType: body.message_type ?? 'text',
      content: body.content ?? undefined,
      attachmentUrl: body.attachment_url ?? undefined,
      isRead: false,
      sentAt: new Date(),
    });

    const payload = {
      message: this.serializeMessage(message as MessageView),
      thread: {
        thread_id: threadId,
        threadId,
        other_user: this.serializeUser(sender),
        otherUser: this.serializeUser(sender),
      },
    };

    emitMessageCreated(body.receiver_id, payload);
    emitMessageCreated(requester.id, {
      ...payload,
      thread: {
        thread_id: threadId,
        threadId,
        other_user: this.serializeUser(receiver),
        otherUser: this.serializeUser(receiver),
      },
    });

    const receiverSenderIds = await this.getAllowedCounterpartyIds(
      body.receiver_id,
      receiver.role,
      receiver.branchId
    );
    const receiverUnreadCount = await this.repo.countUnreadMessages(
      new Types.ObjectId(body.receiver_id),
      receiverSenderIds
    );
    emitMessageUnreadCount(body.receiver_id, receiverUnreadCount);

    return this.serializeMessage(message as MessageView);
  }
}
