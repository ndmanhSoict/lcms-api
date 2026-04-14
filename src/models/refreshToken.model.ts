import mongoose, { Schema, Document } from 'mongoose';

export interface IRefreshToken extends Document {
  schemaVersion: number;
  userId: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  tokenHash: string;
  deviceInfo?: string;
  ipAddress?: string;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
}

const RefreshTokenSchema: Schema = new Schema(
  {
    schemaVersion: { type: Number, default: 1 },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    tokenHash: { type: String, required: true, unique: true },
    deviceInfo: { type: String },
    ipAddress: { type: String },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } } // Chỉ có created_at theo thiết kế
);

export const RefreshToken = mongoose.models.RefreshToken || mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema, 'refresh_tokens');