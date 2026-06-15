// ════════════════════════════════════════════════════════════
// PAYMENT
// ════════════════════════════════════════════════════════════
import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  PAYMENT_METHODS, PaymentMethod,
  PAYMENT_STATUSES, PaymentStatus,
} from '../shared/constants/roles.js';

export interface IPayment extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  studentId: Types.ObjectId;
  paymentMethod: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  receivedBy?: Types.ObjectId;
  receivedAt?: Date;
  vnpayRef?: string;
  /** Raw response từ VNPay */
  vnpayData?: VnpayStoredData;
  // Immutable record — không có updatedAt
  createdAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    schemaVersion: { type: Number, default: 1 },
    branchId:      { type: Schema.Types.ObjectId, ref: 'Branch',  required: true },
    invoiceId:     { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    studentId:     { type: Schema.Types.ObjectId, ref: 'User',    required: true },
    paymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHODS),
      required: true,
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUSES),
      required: true,
      default: PAYMENT_STATUSES.PENDING,
    },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    receivedAt: { type: Date, default: null },
    vnpayRef:   { type: String, default: null },
    vnpayData:  { type: Schema.Types.Mixed, default: null },
  },
  {
    // Immutable record: chỉ createdAt, không updatedAt
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    collection: 'payments',
  }
);

PaymentSchema.index({ invoiceId: 1 }, { name: 'idx_payments_invoice' });
PaymentSchema.index(
  { branchId: 1, createdAt: -1, status: 1 },
  { name: 'idx_payments_branch_date' }
);
PaymentSchema.index({ studentId: 1 }, { name: 'idx_payments_student' });

export const Payment =
  mongoose.models.Payment ||
  mongoose.model<IPayment>('Payment', PaymentSchema, 'payments');
