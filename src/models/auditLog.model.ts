import mongoose, { Schema, Document, Types } from 'mongoose';
import { AUDIT_ACTIONS, AuditAction, ROLES, RoleType } from '../shared/constants/roles.js';

export interface IAuditLog extends Document {
  schemaVersion: number;
  branchId?: Types.ObjectId;
  actorId: Types.ObjectId;
  actorRole: RoleType;
  actorName?: string;
  /** UUID của request — dùng để group nhiều log trong 1 request */
  requestId?: string;
  action: AuditAction;
  targetType?: string;
  targetId?: Types.ObjectId;
  /** Snapshot trước khi thay đổi */
  before?: Record<string, any>;
  /** Snapshot sau khi thay đổi */
  after?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  /** TTL index: tự xóa sau 6 tháng */
  expiresAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    schemaVersion: { type: Number, default: 1 },
    branchId:      { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    actorId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole:     { type: String, enum: Object.values(ROLES), required: true },
    actorName:     { type: String, default: null },
    requestId:     { type: String, default: null },
    action: {
      type: String,
      enum: Object.values(AUDIT_ACTIONS),
      required: true,
    },
    targetType: { type: String, default: null },
    targetId:   { type: Schema.Types.ObjectId, default: null },
    before:     { type: Schema.Types.Mixed, default: null },
    after:      { type: Schema.Types.Mixed, default: null },
    ipAddress:  { type: String, default: null },
    userAgent:  { type: String, default: null },
    expiresAt:  { type: Date, required: true },
  },
  {
    // Immutable — chỉ createdAt
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    collection: 'audit_logs',
  }
);

// TTL: tự xóa sau 6 tháng
AuditLogSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'idx_audit_ttl' }
);
AuditLogSchema.index(
  { branchId: 1, action: 1, createdAt: -1 },
  { name: 'idx_audit_branch_action' }
);
AuditLogSchema.index(
  { actorId: 1, createdAt: -1 },
  { name: 'idx_audit_actor' }
);

export const AuditLog =
  mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>('AuditLog', AuditLogSchema, 'audit_logs');