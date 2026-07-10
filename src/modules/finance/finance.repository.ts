import { Types } from 'mongoose';
import { Invoice, IInvoice } from '../../models/invoice.model.js';
import { Payment, IPayment } from '../../models/payment.model.js';
import { Branch } from '../../models/branch.model.js';
import { User } from '../../models/user.model.js';
import { Class } from '../../models/class.model.js';
import { ClassSession } from '../../models/classSession.model.js';
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

  async findInvoicesByIds(ids: string[]) {
    return await Invoice.find({ _id: { $in: ids }, deletedAt: null });
  }

  async findPayableInvoicesByStudents(
    studentIds: string[],
    branchId: string,
    invoiceIds?: string[]
  ) {
    return await Invoice.find({
      ...(invoiceIds?.length ? { _id: { $in: invoiceIds } } : {}),
      studentId: { $in: studentIds.map(id => new Types.ObjectId(id)) },
      branchId: new Types.ObjectId(branchId),
      status: { $in: ['unpaid', 'partial', 'overdue'] },
      deletedAt: null,
    }).sort({ dueDate: 1, createdAt: 1 });
  }

  async hasActivePayments(invoiceId: string) {
    return Boolean(
      await Payment.exists({
        invoiceId,
        status: { $in: ['pending', 'success'] },
      })
    );
  }

  async softDeleteInvoice(invoiceId: string) {
    return await Invoice.findByIdAndUpdate(
      invoiceId,
      { $set: { deletedAt: new Date(), status: 'cancelled' } },
      { new: true }
    );
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

  async findInvoices(filter: MongoFilter<IInvoice>, skip: number, limit: number) {
    const branchMatch = filter.branchId ? { branchId: filter.branchId } : undefined;
    const [items, total, totalAmountAgg] = await Promise.all([
      Invoice.find(filter)
        .populate({
          path: 'studentId',
          select: 'fullName userCode branchId',
          match: branchMatch,
        })
        .populate({
          path: 'classId',
          select: 'name branchId classType',
          match: branchMatch,
        })
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

  async findActiveEnrollment(studentId: string, classId: string) {
    return await Enrollment.findOne({ studentId, classId, leftAt: null }).lean();
  }

  async findPayments(filter: MongoFilter<IPayment>, skip: number, limit: number) {
    const branchMatch = filter.branchId ? { branchId: filter.branchId } : undefined;
    const [items, total] = await Promise.all([
      Payment.find(filter)
        .populate({
          path: 'invoiceId',
          select: 'invoiceCode billingPeriod status branchId',
          match: branchMatch,
        })
        .populate({
          path: 'studentId',
          select: 'fullName userCode branchId',
          match: branchMatch,
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(filter),
    ]);

    return { items, total };
  }

  async createPayment(data: Partial<IPayment>) {
    return await Payment.create(data);
  }

  async findPaymentByVNPayTxnRef(txnRef: string) {
    return await Payment.findOne({
      paymentMethod: 'vnpay',
      vnpayRef: txnRef,
    }).sort({ createdAt: -1 });
  }

  async updatePaymentVNPayResult(
    paymentDoc: IPayment,
    status: 'success' | 'failed',
    vnpayData: VnpayStoredData
  ) {
    paymentDoc.status = status;
    paymentDoc.receivedAt = status === 'success' ? new Date() : paymentDoc.receivedAt;
    paymentDoc.vnpayData = {
      ...(paymentDoc.vnpayData ?? {}),
      ...vnpayData,
    };
    return await paymentDoc.save();
  }

  async updateInvoiceAfterPayment(
    invoiceDoc: IInvoice,
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
    invoiceDoc: IInvoice,
    paymentId: Types.ObjectId,
    vnpayRef: string,
    vnpayTransactionId: string
  ) {
    const remainingAmount = Math.max(
      0,
      (invoiceDoc.totalAmount ?? 0) - (invoiceDoc.paidAmount ?? 0)
    );
    const totalPaid = (invoiceDoc.paidAmount ?? 0) + remainingAmount;
    invoiceDoc.status = 'paid';
    invoiceDoc.paidAmount = totalPaid;
    invoiceDoc.paidAt = new Date();
    invoiceDoc.paymentMethod = 'vnpay';
    invoiceDoc.vnpayTransactionRef = vnpayRef;
    invoiceDoc.vnpayTransactionId = vnpayTransactionId;
    invoiceDoc.paymentIds.push(paymentId);
    return await invoiceDoc.save();
  }

  async updateInvoicesVNPay(
    invoiceDocs: IInvoice[],
    paymentId: Types.ObjectId,
    vnpayRef: string,
    vnpayTransactionId: string
  ) {
    const updated: IInvoice[] = [];
    for (const invoiceDoc of invoiceDocs) {
      const remainingAmount = Math.max(
        0,
        (invoiceDoc.totalAmount ?? 0) - (invoiceDoc.paidAmount ?? 0)
      );
      const totalPaid = (invoiceDoc.paidAmount ?? 0) + remainingAmount;
      invoiceDoc.status = 'paid';
      invoiceDoc.paidAmount = totalPaid;
      invoiceDoc.paidAt = new Date();
      invoiceDoc.paymentMethod = 'vnpay';
      invoiceDoc.vnpayTransactionRef = `${vnpayRef}:${invoiceDoc._id.toString()}`;
      invoiceDoc.vnpayTransactionId = vnpayTransactionId;
      invoiceDoc.paymentIds.push(paymentId);
      updated.push(await invoiceDoc.save());
    }
    return updated;
  }

  // 12.2 Batch: lấy tất cả enrollment active của branch
  async findActiveEnrollmentsByBranch(branchId: string) {
    return await Enrollment.find({ branchId, leftAt: null }).lean();
  }

  async findActiveEnrollmentsByClass(classId: string, branchId: string) {
    return await Enrollment.find({ classId, branchId, leftAt: null }).lean();
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

  async countChargeableClassSessions(classId: string, from: Date, to: Date) {
    return await ClassSession.countDocuments({
      classId,
      deletedAt: null,
      status: { $ne: 'cancelled' },
      sessionDate: { $gte: from, $lte: to },
    });
  }

  async findCancelledSessionIds(classId: string, from: Date, to: Date) {
    const sessions = await ClassSession.find({
      classId,
      deletedAt: null,
      status: 'cancelled',
      sessionDate: { $gte: from, $lte: to },
    })
      .select('_id')
      .lean();

    return sessions.map(session => session._id.toString());
  }

  async findAbsentSessionIds(studentId: string, classId: string, from: Date, to: Date) {
    const attendances = await Attendance.find({
      studentId,
      classId,
      status: 'absent',
      sessionDate: { $gte: from, $lte: to },
    })
      .select('sessionId')
      .lean();

    return attendances.map(attendance => attendance.sessionId.toString());
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
    before?: AuditSnapshot;
    after?: AuditSnapshot;
  }) {
    return await AuditLog.create({
      ...data,
      targetType: 'Invoice',
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    });
  }
}
