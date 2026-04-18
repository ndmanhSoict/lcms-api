// ════════════════════════════════════════════════════════════
// MESSAGE
// ════════════════════════════════════════════════════════════
import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  MESSAGE_TYPES, MessageType,
} from '../shared/constants/roles.js';

export interface IMessage extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;
  /**
   * thread_id = sort([userId1.toString(), userId2.toString()]).join('_')
   * Đảm bảo 1 cặp user chỉ có 1 thread duy nhất.
   */
  threadId: string;
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  messageType: MessageType;
  content?: string;
  attachmentUrl?: string;
  isRead: boolean;
  readAt?: Date;
  sentAt: Date;
  deletedAt?: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    schemaVersion: { type: Number, default: 1 },
    branchId:      { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    threadId:      { type: String, required: true },
    senderId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
    messageType: {
      type: String,
      enum: Object.values(MESSAGE_TYPES),
      required: true,
      default: MESSAGE_TYPES.TEXT,
    },
    content:       { type: String, default: null },
    attachmentUrl: { type: String, default: null },
    isRead:        { type: Boolean, default: false },
    readAt:        { type: Date, default: null },
    sentAt:        { type: Date, required: true, default: () => new Date() },
    deletedAt:     { type: Date, default: null },
  },
  {
    // Không dùng timestamps — sentAt tự quản lý
    timestamps: false,
    collection: 'messages',
  }
);

// Q14: load conversation theo thread
MessageSchema.index({ threadId: 1, sentAt: 1 }, { name: 'idx_messages_thread' });
MessageSchema.index(
  { receiverId: 1, isRead: 1, sentAt: -1 },
  { name: 'idx_messages_unread' }
);

export const Message =
  mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema, 'messages');


