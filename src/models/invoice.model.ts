import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  INVOICE_TYPES, InvoiceType,
  INVOICE_STATUSES, InvoiceStatus,
  PAYMENT_METHODS, PaymentMethod,
  GENERATION_TYPES, GenerationType,
} from '../shared/constants/roles.js';

// ════════════════════════════════════════════════════════════
// INVOICE
// ════════════════════════════════════════════════════════════

export interface IStudentSnapshot {
  fullName: string;
  studentCode?: string;
}

export interface IClassSnapshotInvoice {
  name: string;
  subjectName: string;
}

export interface IInvoice extends Document {
  schemaVersion: number;
  branchId: Types.ObjectId;
  studentId: Types.ObjectId;
  classId: Types.ObjectId;
  /** Snapshot tài chính — giữ nguyên dù HS/lớp thay đổi sau */
  studentSnapshot?: IStudentSnapshot;
  classSnapshot?: IClassSnapshotInvoice;
  invoiceCode: string;
  invoiceType: InvoiceType;
  /** Format "YYYY-MM" — ví dụ "2025-03" */
  billingPeriod?: string;
  sessionsAttended?: number;
  sessionsTotal?: number;
  feePerSession?: number;
  courseFee?: number;
  subtotal: number;
  discountAmount: number;
  discountNote?: string;
  excusedSessions: number;
  totalAmount: number;
  dueDate?: Date;
  status: InvoiceStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: Date;
  paidAmount?: number;
  confirmedBy?: Types.ObjectId;
  paymentIds: Types.ObjectId[];
  vnpayTransactionRef?: string;
  vnpayTransactionId?: string;
  generationType: GenerationType;
  note?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

const StudentSnapshotSchema = new Schema<IStudentSnapshot>(
  {
    fullName:    { type: String, required: true },
    studentCode: { type: String, default: null },
  },
  { _id: false }
);

const ClassSnapshotInvoiceSchema = new Schema<IClassSnapshotInvoice>(
  {
    name:        { type: String, required: true },
    subjectName: { type: String, required: true },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    schemaVersion:    { type: Number, default: 1 },
    branchId:         { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    studentId:        { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    classId:          { type: Schema.Types.ObjectId, ref: 'Class',  required: true },
    studentSnapshot:  { type: StudentSnapshotSchema, default: null },
    classSnapshot:    { type: ClassSnapshotInvoiceSchema, default: null },
    invoiceCode:      { type: String, required: true },
    invoiceType: {
      type: String,
      enum: Object.values(INVOICE_TYPES),
      default: INVOICE_TYPES.MONTHLY,
    },
    billingPeriod:     { type: String, default: null },
    sessionsAttended:  { type: Number, default: null },
    sessionsTotal:     { type: Number, default: null },
    feePerSession:     { type: Number, default: null },
    courseFee:         { type: Number, default: null },
    subtotal:          { type: Number, required: true },
    discountAmount:    { type: Number, default: 0 },
    discountNote:      { type: String, default: null },
    excusedSessions:   { type: Number, default: 0 },
    totalAmount:       { type: Number, required: true },
    dueDate:           { type: Date, default: null },
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUSES),
      required: true,
      default: INVOICE_STATUSES.UNPAID,
    },
    paymentMethod:       { type: String, enum: [...Object.values(PAYMENT_METHODS), null], default: null },
    paidAt:              { type: Date, default: null },
    paidAmount:          { type: Number, default: null },
    confirmedBy:         { type: Schema.Types.ObjectId, ref: 'User', default: null },
    paymentIds:          { type: [Schema.Types.ObjectId], ref: 'Payment', default: [] },
    vnpayTransactionRef: { type: String, default: null },
    vnpayTransactionId:  { type: String, default: null },
    generationType: {
      type: String,
      enum: Object.values(GENERATION_TYPES),
      default: GENERATION_TYPES.AUTO,
    },
    note:      { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'invoices',
  }
);

InvoiceSchema.index({ invoiceCode: 1 }, { unique: true, name: 'idx_invoices_code' });
// Q05: phiếu chưa thanh toán
InvoiceSchema.index(
  { branchId: 1, status: 1, dueDate: 1 },
  { name: 'idx_invoices_branch_status_due' }
);
// Q07: doanh thu theo tháng
InvoiceSchema.index(
  { branchId: 1, billingPeriod: 1, status: 1 },
  { name: 'idx_invoices_branch_period_status' }
);
// Idempotent VNPay webhook
InvoiceSchema.index(
  { vnpayTransactionRef: 1 },
  {
    unique: true,
    partialFilterExpression: { vnpayTransactionRef: { $type: 'string' } },
    name: 'idx_invoices_vnpay_ref',
  }
);
InvoiceSchema.index(
  { studentId: 1, billingPeriod: 1 },
  { name: 'idx_invoices_student_period' }
);

export const Invoice =
  mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema, 'invoices');

