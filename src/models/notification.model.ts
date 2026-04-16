import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  NOTIFICATION_TYPES, NotificationType,
} from '../shared/constants/roles.js';

// ════════════════════════════════════════════════════════════
// NOTIFICATION
// ════════════════════════════════════════════════════════════

export interface INotification extends Document {
  schemaVersion: number;
  branchId?: Types.ObjectId;
  recipientId: Types.ObjectId;
  type: NotificationType;
  title: string;
  content?: string;
  actionUrl?: string;
  /** ['in_app', 'email'] */
  channels: string[];
  metadata?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  emailSent: boolean;
  emailSentAt?: Date;
  createdAt: Date;
  /** TTL index tự xóa sau 6 tháng */
  expiresAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    schemaVersion: { type: Number, default: 1 },
    branchId:      { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    recipientId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true,
    },
    title:      { type: String, required: true },
    content:    { type: String, default: null },
    actionUrl:  { type: String, default: null },
    channels:   { type: [String], default: ['in_app'] },
    metadata:   { type: Schema.Types.Mixed, default: null },
    isRead:     { type: Boolean, required: true, default: false },
    readAt:     { type: Date, default: null },
    emailSent:    { type: Boolean, default: false },
    emailSentAt:  { type: Date, default: null },
    // expiresAt không dùng timestamps — cần set thủ công khi tạo
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    collection: 'notifications',
  }
);

// Q13: thông báo chưa đọc, mới nhất trước
NotificationSchema.index(
  { recipientId: 1, isRead: 1, createdAt: -1 },
  { name: 'idx_notif_user_unread' }
);
// TTL: tự xóa sau 6 tháng
NotificationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'idx_notif_ttl' }
);

export const Notification =
  mongoose.models.Notification ||
  mongoose.model<INotification>('Notification', NotificationSchema, 'notifications');


