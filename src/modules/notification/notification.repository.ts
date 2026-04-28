import { Types } from 'mongoose';
import { Notification } from '../../models/notification.model.js';

export class NotificationRepository {
  async findByRecipient(
    recipientId: string,
    filter: Record<string, any>,
    skip: number,
    limit: number
  ) {
    const query = { recipientId: new Types.ObjectId(recipientId), ...filter };
    const [items, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipientId: new Types.ObjectId(recipientId), isRead: false }),
    ]);
    return { items, total, unreadCount };
  }

  async findByIdAndRecipient(id: string, recipientId: string) {
    return await Notification.findOne({
      _id: id,
      recipientId: new Types.ObjectId(recipientId),
    });
  }

  async markAllAsRead(recipientId: string) {
    const result = await Notification.updateMany(
      { recipientId: new Types.ObjectId(recipientId), isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    return result.modifiedCount;
  }
}
