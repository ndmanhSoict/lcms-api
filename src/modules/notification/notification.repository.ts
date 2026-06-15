import { Types } from 'mongoose';
import { Notification, INotification } from '../../models/notification.model.js';

export class NotificationRepository {
  async findByRecipient(
    recipientId: string,
    filter: MongoFilter<INotification>,
    skip: number,
    limit: number
  ) {
    const query = { recipientId: new Types.ObjectId(recipientId), ...filter };
    const unreadQuery = { ...query };
    delete (unreadQuery as Partial<INotification>).isRead;
    const [items, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...unreadQuery, isRead: false }),
    ]);
    return { items, total, unreadCount };
  }

  async findByIdAndRecipient(
    id: string,
    recipientId: string,
    scope: MongoFilter<INotification> = {}
  ) {
    return await Notification.findOne({
      _id: id,
      recipientId: new Types.ObjectId(recipientId),
      ...scope,
    });
  }

  async markAllAsRead(recipientId: string, scope: MongoFilter<INotification> = {}) {
    const result = await Notification.updateMany(
      { recipientId: new Types.ObjectId(recipientId), isRead: false, ...scope },
      { $set: { isRead: true, readAt: new Date() } }
    );
    return result.modifiedCount;
  }

  async countUnread(recipientId: string, scope: MongoFilter<INotification> = {}) {
    return await Notification.countDocuments({
      recipientId: new Types.ObjectId(recipientId),
      isRead: false,
      ...scope,
    });
  }
}
