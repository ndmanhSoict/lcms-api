import mongoose, { Schema, Document, Types } from 'mongoose';
import { REVOKE_REASONS, RevokeReason } from '../shared/constants/roles.js';

export interface IRefreshToken extends Document {
  schemaVersion: number;
  userId: Types.ObjectId;
  branchId?: Types.ObjectId;
  /** Hash của token — không lưu raw token */
  tokenHash: string;
  deviceInfo?: string;
  ipAddress?: string;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: RevokeReason;
  createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    schemaVersion: { type: Number, default: 1 },
    userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    branchId:      { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    tokenHash:     { type: String, required: true },
    deviceInfo:    { type: String, default: null },
    ipAddress:     { type: String, default: null },
    expiresAt:     { type: Date, required: true },
    revokedAt:     { type: Date, default: null },
    revokedReason: {
      type: String,
      enum: [...Object.values(REVOKE_REASONS), null],
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    collection: 'refresh_tokens',
  }
);

// ── Indexes ──────────────────────────────────────────────────
RefreshTokenSchema.index({ tokenHash: 1 }, { unique: true, name: 'idx_rtokens_hash' });
RefreshTokenSchema.index({ userId: 1, revokedAt: 1 }, { name: 'idx_rtokens_user_active' });
// TTL: tự xóa document khi expiresAt đến
RefreshTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'idx_rtokens_ttl' }
);

export const RefreshToken =
  mongoose.models.RefreshToken ||
  mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema, 'refresh_tokens');