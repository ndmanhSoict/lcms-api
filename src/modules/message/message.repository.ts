import { Types } from 'mongoose';
import { Message, IMessage } from '../../models/message.model.js';
import { User, IUser } from '../../models/user.model.js';
import { Enrollment } from '../../models/enrollment.model.js';
import { Class } from '../../models/class.model.js';

export class MessageRepository {
  async findUserById(id: string) {
    return await User.findById(id).lean();
  }

  async findUsers(filter: MongoFilter<IUser>, limit: number) {
    return await User.find(filter)
      .select('fullName role userCode email avatarUrl branchId')
      .sort({ fullName: 1 })
      .limit(limit)
      .lean();
  }

  async getBranchIdsForParent(parentId: string) {
    const parent = await User.findById(parentId).select('parentInfo.studentIds').lean();
    const childIds = parent?.parentInfo?.studentIds ?? [];
    if (!childIds.length) return [];

    const children = await User.find({ _id: { $in: childIds }, deletedAt: null })
      .select('branchId')
      .lean();

    return [...new Set(children.map(child => child.branchId?.toString()).filter(Boolean))];
  }

  // Kiểm tra GV có lớp nào chứa HS mà PH đó quản lý không
  async teacherHasParentConnection(teacherId: string, parentId: string) {
    const parent = await User.findById(parentId).lean();
    const childIds = parent?.parentInfo?.studentIds ?? [];
    if (childIds.length === 0) return false;

    // Lấy lớp của GV
    const teacherClasses = await Class.find({
      teacherId: new Types.ObjectId(teacherId),
      status: 'active',
      deletedAt: null,
    })
      .select('_id')
      .lean();
    const classIds = teacherClasses.map(c => c._id);

    // Kiểm tra ít nhất 1 con đang học trong lớp GV
    const enrollment = await Enrollment.findOne({
      studentId: { $in: childIds },
      classId: { $in: classIds },
      leftAt: null,
    }).lean();

    return !!enrollment;
  }

  // Kiểm tra PH có con nào học lớp mà GV đó dạy không
  async parentHasTeacherConnection(parentId: string, teacherId: string) {
    return this.teacherHasParentConnection(teacherId, parentId);
  }

  async getThreadsForUser(userId: Types.ObjectId) {
    return await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { receiverId: userId }],
          deletedAt: null,
        },
      },
      { $sort: { sentAt: -1 } },
      {
        $group: {
          _id: '$threadId',
          lastContent: { $first: '$content' },
          lastMessageType: { $first: '$messageType' },
          lastSenderId: { $first: '$senderId' },
          lastSentAt: { $first: '$sentAt' },
          otherUserId: {
            $first: {
              $cond: [{ $eq: ['$senderId', userId] }, '$receiverId', '$senderId'],
            },
          },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$isRead', false] }, { $eq: ['$receiverId', userId] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { lastSentAt: -1 } },
    ]);
  }

  async getThreadMessages(threadId: string, skip: number, limit: number) {
    return await Message.find({ threadId, deletedAt: null })
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async countThreadMessages(threadId: string) {
    return await Message.countDocuments({ threadId, deletedAt: null });
  }

  async countUnreadMessages(userId: Types.ObjectId, senderIds?: Types.ObjectId[]) {
    return await Message.countDocuments({
      receiverId: userId,
      ...(senderIds && { senderId: { $in: senderIds } }),
      isRead: false,
      deletedAt: null,
    });
  }

  async createMessage(data: Partial<IMessage>) {
    return await Message.create(data);
  }

  async markThreadAsRead(threadId: string, receiverId: Types.ObjectId) {
    const result = await Message.updateMany(
      { threadId, receiverId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    return result.modifiedCount;
  }
}
