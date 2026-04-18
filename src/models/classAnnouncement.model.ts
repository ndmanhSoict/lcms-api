// ════════════════════════════════════════════════════════════
// CLASS ANNOUNCEMENT
// ════════════════════════════════════════════════════════════
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IClassAnnouncement extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;
  classId: Types.ObjectId;
  authorId: Types.ObjectId;
  title: string;
  content?: string;
  attachmentUrls: string[];
  /** ['student', 'parent'] */
  targetAudience: string[];
  isPinned: boolean;
  notificationSent: boolean;
  notificationSentAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

const ClassAnnouncementSchema = new Schema<IClassAnnouncement>(
  {
    schemaVersion:      { type: Number, default: 1 },
    branchId:           { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    classId:            { type: Schema.Types.ObjectId, ref: 'Class',  required: true },
    authorId:           { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    title:              { type: String, required: true },
    content:            { type: String, default: null },
    attachmentUrls:     { type: [String], default: [] },
    targetAudience:     { type: [String], default: ['student', 'parent'] },
    isPinned:           { type: Boolean, default: false },
    notificationSent:   { type: Boolean, default: false },
    notificationSentAt: { type: Date, default: null },
    deletedAt:          { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'class_announcements',
  }
);

ClassAnnouncementSchema.index(
  { classId: 1, createdAt: -1 },
  { name: 'idx_announcements_class_date' }
);
ClassAnnouncementSchema.index(
  { classId: 1, isPinned: 1, createdAt: -1 },
  { name: 'idx_announcements_pinned' }
);

export const ClassAnnouncement =
  mongoose.models.ClassAnnouncement ||
  mongoose.model<IClassAnnouncement>(
    'ClassAnnouncement',
    ClassAnnouncementSchema,
    'class_announcements'
  );