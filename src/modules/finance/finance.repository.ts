import { Types } from 'mongoose';
import { Invoice, IInvoice } from '../../models/invoice.model.js';
import { Payment, IPayment } from '../../models/payment.model.js';
import { Branch } from '../../models/branch.model.js';
import { User } from '../../models/user.model.js';
import { Class } from '../../models/class.model.js';
import { Enrollment } from '../../models/enrollment.model.js';
import { Attendance } from '../../models/attendance.model.js';
import { AuditLog } from '../../models/auditLog.model.js';

export class FinanceRepository {
  async findBranchById(branchId: string) {
    return await Branch.findById(branchId).lean();
  }

  async findStudentById(studentId: string) {
    return await User.findById(studentId).lean();
  }

  async findClassById(classId: string) {
    return await Class.findOne({ _id: classId, deletedAt: null }).lean();
  }

  async findInvoiceById(id: string) {
    return await Invoice.findOne({ _id: id, deletedAt: null });
  }

  async findExistingInvoice(studentId: string, classId: string, billingPeriod: string) {
    return await Invoice.findOne({ studentId, classId, billingPeriod, deletedAt: null }).lean();
  }

  async generateInvoiceCode(branchCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${branchCode}-${year}-`;
    const count = await Invoice.countDocuments({
      invoiceCode: { $regex: `^${prefix}` },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  async createInvoice(data: Partial<IInvoice>) {
    return await Invoice.create(data);
  }

  async findInvoices(filter: Record<string, any>, skip: number, limit: number) {
    const [items, total, totalAmountAgg] = await Promise.all([
      Invoice.find(filter)
        .populate('studentId', 'fullName userCode')
        .populate('classId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
      Invoice.aggregate([
        { $match: filter },
        { $group: { _id: null, totalAmount: { $sum: '$totalAmount' } } },
      ]),
    ]);
    const totalAmount = totalAmountAgg[0]?.totalAmount ?? 0;
    return { items, total, totalAmount };
  }

  async createPayment(data: Partial<IPayment>) {
    return await Payment.create(data);
  }

  async updateInvoiceAfterPayment(
    invoiceDoc: any,
    paymentId: Types.ObjectId,
    paidAmount: number,
    confirmedBy: Types.ObjectId
  ) {
    const totalPaid = (invoiceDoc.paidAmount ?? 0) + paidAmount;
    const isPaidFull = totalPaid >= invoiceDoc.totalAmount;

    invoiceDoc.status = isPaidFull ? 'paid' : 'partial';
    invoiceDoc.paidAmount = totalPaid;
    invoiceDoc.paidAt = isPaidFull ? new Date() : invoiceDoc.paidAt;
    invoiceDoc.confirmedBy = confirmedBy;
    invoiceDoc.paymentMethod = 'cash';
    invoiceDoc.paymentIds.push(paymentId);

    return await invoiceDoc.save();
  }

  async updateInvoiceVNPay(
    invoiceDoc: any,
    paymentId: Types.ObjectId,
    vnpayRef: string,
    vnpayTransactionId: string
  ) {
    const totalPaid = (invoiceDoc.paidAmount ?? 0) + invoiceDoc.totalAmount;
    invoiceDoc.status = 'paid';
    invoiceDoc.paidAmount = totalPaid;
    invoiceDoc.paidAt = new Date();
    invoiceDoc.paymentMethod = 'vnpay';
    invoiceDoc.vnpayTransactionRef = vnpayRef;
    invoiceDoc.vnpayTransactionId = vnpayTransactionId;
    invoiceDoc.paymentIds.push(paymentId);
    return await invoiceDoc.save();
  }

  // 12.2 Batch: lấy tất cả enrollment active của branch
  async findActiveEnrollmentsByBranch(branchId: string) {
    return await Enrollment.find({ branchId, leftAt: null }).lean();
  }

  // Đếm buổi có mặt trong tháng (billing period = "YYYY-MM")
  async countPresentSessions(studentId: string, classId: string, billingPeriod: string) {
    const [year, month] = billingPeriod.split('-').map(Number);
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999);

    return await Attendance.countDocuments({
      studentId,
      classId,
      status: 'present',
      sessionDate: { $gte: from, $lte: to },
    });
  }

  async findInvoiceByVNPayRef(vnpayRef: string) {
    return await Invoice.findOne({ vnpayTransactionRef: vnpayRef }).lean();
  }

  async createAuditLog(data: {
    action: string;
    actorId: Types.ObjectId;
    actorRole: string;
    branchId: Types.ObjectId;
    targetId: Types.ObjectId;
    before?: Record<string, any>;
    after?: Record<string, any>;
  }) {
    return await AuditLog.create({
      ...data,
      targetType: 'Invoice',
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    });
  }
}
