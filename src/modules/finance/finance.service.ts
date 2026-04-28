import { Types } from 'mongoose';
import { FinanceRepository } from './finance.repository.js';
import { ROLES } from '../../shared/constants/roles.js';
import { getPagination, getPaginationMeta } from '../../shared/constants/pagination.helper.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} from '../../shared/errors/AllErrors.js';

export class FinanceService {
  private repo: FinanceRepository;

  constructor() {
    this.repo = new FinanceRepository();
  }

  private checkAdminAccess(branchId: string, requester: any) {
    if (requester.role === ROLES.SYSTEM_OWNER) return;
    if (requester.branchId !== branchId) throw new ForbiddenError('Không thuộc cơ sở của bạn');
  }

  // 12.1 Tạo phiếu học phí thủ công
  async createInvoice(body: any, requester: any) {
    const student = await this.repo.findStudentById(body.student_id);
    if (!student || student.role !== ROLES.STUDENT) throw new NotFoundError('Học sinh');

    const cls = await this.repo.findClassById(body.class_id);
    if (!cls) throw new NotFoundError('Lớp học');

    this.checkAdminAccess(cls.branchId.toString(), requester);

    const branch = await this.repo.findBranchById(cls.branchId.toString());
    if (!branch) throw new NotFoundError('Cơ sở');

    // Idempotent: kiểm tra đã có phiếu chưa
    const existing = await this.repo.findExistingInvoice(body.student_id, body.class_id, body.billing_period);
    if (existing) throw new ConflictError('Đã có phiếu học phí cho học sinh này trong kỳ đó');

    const subtotal = body.sessions_attended * body.fee_per_session;
    const totalAmount = Math.max(0, subtotal - (body.discount_amount ?? 0));
    const invoiceCode = await this.repo.generateInvoiceCode(branch.branchCode);

    const invoice = await this.repo.createInvoice({
      branchId: cls.branchId,
      studentId: new Types.ObjectId(body.student_id),
      classId: new Types.ObjectId(body.class_id),
      studentSnapshot: { fullName: student.fullName, studentCode: student.userCode ?? undefined },
      classSnapshot: { name: cls.name, subjectName: cls.subject?.name ?? '' },
      invoiceCode,
      invoiceType: body.invoice_type,
      billingPeriod: body.billing_period,
      sessionsAttended: body.sessions_attended,
      feePerSession: body.fee_per_session,
      subtotal,
      discountAmount: body.discount_amount ?? 0,
      discountNote: body.discount_note ?? null,
      totalAmount,
      dueDate: body.due_date ? new Date(body.due_date) : undefined,
      status: 'unpaid',
      generationType: 'manual',
      note: body.note ?? null,
      createdBy: new Types.ObjectId(requester.id),
    });

    await this.repo.createAuditLog({
      action: 'CHANGE_INVOICE',
      actorId: new Types.ObjectId(requester.id),
      actorRole: requester.role,
      branchId: cls.branchId,
      targetId: invoice._id as Types.ObjectId,
      after: { invoiceCode, totalAmount, status: 'unpaid' },
    });

    // Mock notification PH
    console.log(`[Notification] Phiếu học phí tháng ${body.billing_period} đã sẵn sàng cho HS ${student.fullName}`);

    return {
      _id: invoice._id,
      invoice_code: invoice.invoiceCode,
      student_id: body.student_id,
      billing_period: invoice.billingPeriod,
      sessions_attended: invoice.sessionsAttended,
      subtotal,
      discount_amount: invoice.discountAmount,
      total_amount: invoice.totalAmount,
      status: invoice.status,
      due_date: invoice.dueDate,
      generation_type: invoice.generationType,
    };
  }

  // 12.2 Batch generate phiếu học phí
  async batchGenerateInvoices(body: any, requester: any) {
    const branch = await this.repo.findBranchById(body.branch_id);
    if (!branch) throw new NotFoundError('Cơ sở');
    this.checkAdminAccess(body.branch_id, requester);

    const enrollments = await this.repo.findActiveEnrollmentsByBranch(body.branch_id);

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    await Promise.all(
      enrollments.map(async enrollment => {
        try {
          const studentId = enrollment.studentId.toString();
          const classId = enrollment.classId.toString();

          // Skip nếu đã có phiếu
          const exists = await this.repo.findExistingInvoice(studentId, classId, body.billing_period);
          if (exists) { skipped++; return; }

          const sessionsAttended = await this.repo.countPresentSessions(
            studentId,
            classId,
            body.billing_period
          );
          if (sessionsAttended === 0) { skipped++; return; }

          const cls = await this.repo.findClassById(classId);
          if (!cls) { skipped++; return; }

          const student = await this.repo.findStudentById(studentId);
          if (!student) { skipped++; return; }

          const feePerSession = (cls as any).ongoingInfo?.feePerSession ?? branch.defaultFeePerSession ?? 0;
          const subtotal = sessionsAttended * feePerSession;
          const invoiceCode = await this.repo.generateInvoiceCode(branch.branchCode);

          await this.repo.createInvoice({
            branchId: new Types.ObjectId(body.branch_id),
            studentId: enrollment.studentId,
            classId: enrollment.classId,
            studentSnapshot: { fullName: student.fullName, studentCode: student.userCode ?? undefined },
            classSnapshot: { name: cls.name, subjectName: cls.subject?.name ?? '' },
            invoiceCode,
            invoiceType: 'monthly',
            billingPeriod: body.billing_period,
            sessionsAttended,
            feePerSession,
            subtotal,
            discountAmount: 0,
            totalAmount: subtotal,
            dueDate: body.due_date ? new Date(body.due_date) : undefined,
            status: 'unpaid',
            generationType: 'auto',
          });

          generated++;
        } catch {
          failed++;
        }
      })
    );

    const [yearStr, monthStr] = body.billing_period.split('-');
    return {
      generated,
      skipped,
      failed,
      message: `Đã tạo ${generated} phiếu học phí tháng ${monthStr}/${yearStr}`,
    };
  }

  // 12.3 Lấy danh sách phiếu học phí
  async getInvoices(query: any, requester: any) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: Record<string, any> = { deletedAt: null };

    // RBAC
    if (requester.role === ROLES.PARENT) {
      const { User } = await import('../../models/user.model.js');
      const parent = await User.findById(requester.id).lean();
      const childIds = parent?.parentInfo?.studentIds ?? [];
      filter.studentId = { $in: childIds };
    } else if (requester.role !== ROLES.SYSTEM_OWNER) {
      filter.branchId = new Types.ObjectId(requester.branchId);
    }

    if (query.branch_id && requester.role === ROLES.SYSTEM_OWNER) {
      filter.branchId = new Types.ObjectId(query.branch_id);
    }
    if (query.student_id) filter.studentId = new Types.ObjectId(query.student_id);
    if (query.status) filter.status = query.status;
    if (query.billing_period) filter.billingPeriod = query.billing_period;
    if (query.due_date_before) filter.dueDate = { $lte: new Date(query.due_date_before) };

    const { items, total, totalAmount } = await this.repo.findInvoices(filter, skip, limit);

    const data = items.map(inv => ({
      _id: inv._id,
      invoice_code: inv.invoiceCode,
      student: {
        _id: (inv.studentId as any)?._id ?? inv.studentId,
        full_name: (inv.studentId as any)?.fullName ?? null,
        user_code: (inv.studentId as any)?.userCode ?? null,
      },
      class: {
        _id: (inv.classId as any)?._id ?? inv.classId,
        name: (inv.classId as any)?.name ?? null,
      },
      billing_period: inv.billingPeriod,
      total_amount: inv.totalAmount,
      status: inv.status,
      due_date: inv.dueDate,
    }));

    return {
      data,
      meta: { ...getPaginationMeta(total, page, limit), total_amount: totalAmount },
    };
  }

  // 12.4 Lấy chi tiết phiếu học phí
  async getInvoiceById(id: string, requester: any) {
    const invoice = await this.repo.findInvoiceById(id);
    if (!invoice) throw new NotFoundError('Phiếu học phí');

    if (requester.role === ROLES.PARENT) {
      const { User } = await import('../../models/user.model.js');
      const parent = await User.findById(requester.id).lean();
      const childIds = parent?.parentInfo?.studentIds?.map(String) ?? [];
      if (!childIds.includes(invoice.studentId.toString())) {
        throw new ForbiddenError('Đây không phải phiếu học phí của con bạn');
      }
    } else if (requester.role !== ROLES.SYSTEM_OWNER) {
      if (invoice.branchId.toString() !== requester.branchId) {
        throw new ForbiddenError('Phiếu học phí không thuộc cơ sở của bạn');
      }
    }

    return {
      _id: invoice._id,
      invoice_code: invoice.invoiceCode,
      student_snapshot: invoice.studentSnapshot,
      class_snapshot: invoice.classSnapshot,
      billing_period: invoice.billingPeriod,
      sessions_attended: invoice.sessionsAttended,
      fee_per_session: invoice.feePerSession,
      subtotal: invoice.subtotal,
      discount_amount: invoice.discountAmount,
      total_amount: invoice.totalAmount,
      status: invoice.status,
      due_date: invoice.dueDate,
      payment_ids: invoice.paymentIds,
    };
  }

  // 12.5 Thu tiền mặt
  async payCash(id: string, body: any, requester: any) {
    const invoice = await this.repo.findInvoiceById(id);
    if (!invoice) throw new NotFoundError('Phiếu học phí');

    this.checkAdminAccess(invoice.branchId.toString(), requester);

    if (!['unpaid', 'partial', 'overdue'].includes(invoice.status)) {
      throw new BadRequestError(`Phiếu học phí đang ở trạng thái ${invoice.status}, không thể thu tiền`);
    }

    const before = { status: invoice.status, paidAmount: invoice.paidAmount };

    const payment = await this.repo.createPayment({
      branchId: invoice.branchId,
      invoiceId: invoice._id as Types.ObjectId,
      studentId: invoice.studentId,
      paymentMethod: 'cash',
      amount: body.amount,
      status: 'success',
      receivedBy: new Types.ObjectId(requester.id),
      receivedAt: new Date(),
    });

    const updated = await this.repo.updateInvoiceAfterPayment(
      invoice,
      payment._id as Types.ObjectId,
      body.amount,
      new Types.ObjectId(requester.id)
    );

    await this.repo.createAuditLog({
      action: 'CONFIRM_PAYMENT',
      actorId: new Types.ObjectId(requester.id),
      actorRole: requester.role,
      branchId: invoice.branchId,
      targetId: invoice._id as Types.ObjectId,
      before,
      after: { status: updated.status, paidAmount: updated.paidAmount },
    });

    // Mock notification PH
    console.log(`[Notification] Xác nhận thanh toán phiếu ${invoice.invoiceCode} — ${body.amount.toLocaleString('vi-VN')} đ`);

    return {
      invoice_id: id,
      status: updated.status,
      payment: {
        _id: payment._id,
        payment_method: 'cash',
        amount: body.amount,
        received_by: requester.id,
        received_at: payment.createdAt,
      },
    };
  }

  // 12.6 Tạo link thanh toán VNPay (mock)
  async vnpayCreatePayment(id: string, body: any, requester: any) {
    const invoice = await this.repo.findInvoiceById(id);
    if (!invoice) throw new NotFoundError('Phiếu học phí');

    if (requester.role === ROLES.PARENT) {
      const { User } = await import('../../models/user.model.js');
      const parent = await User.findById(requester.id).lean();
      const childIds = parent?.parentInfo?.studentIds?.map(String) ?? [];
      if (!childIds.includes(invoice.studentId.toString())) {
        throw new ForbiddenError('Đây không phải phiếu học phí của con bạn');
      }
    } else if (requester.role !== ROLES.SYSTEM_OWNER) {
      this.checkAdminAccess(invoice.branchId.toString(), requester);
    }

    if (!['unpaid', 'partial', 'overdue'].includes(invoice.status)) {
      throw new BadRequestError('Phiếu học phí không ở trạng thái có thể thanh toán');
    }

    // VNPay amount tính bằng đồng × 100
    const vnpAmount = invoice.totalAmount * 100;
    const txnRef = invoice.invoiceCode;
    const createDate = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);

    // Mock URL — production sẽ dùng HMAC-SHA512 với VNPay secret key
    const mockParams = new URLSearchParams({
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: 'LCMSDEMO',
      vnp_Amount: String(vnpAmount),
      vnp_CreateDate: createDate,
      vnp_CurrCode: 'VND',
      vnp_IpAddr: '127.0.0.1',
      vnp_Locale: 'vn',
      vnp_OrderInfo: txnRef,
      vnp_OrderType: 'education',
      vnp_ReturnUrl: body.return_url,
      vnp_TxnRef: txnRef,
      ...(body.bank_code ? { vnp_BankCode: body.bank_code } : {}),
    });

    const paymentUrl = `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?${mockParams.toString()}&vnp_SecureHash=MOCK_HASH`;

    return {
      payment_url: paymentUrl,
      invoice_code: invoice.invoiceCode,
      amount: invoice.totalAmount,
    };
  }

  // 12.7 VNPay Webhook (IPN)
  async vnpayWebhook(body: any) {
    const vnpResponseCode = body.vnp_ResponseCode;
    const vnpTxnRef = body.vnp_TxnRef;
    const vnpTransactionNo = body.vnp_TransactionNo;
    const vnpSecureHash = body.vnp_SecureHash;

    // Bắt buộc có secure hash
    if (!vnpSecureHash) {
      return { RspCode: '97', Message: 'Invalid Checksum' };
    }

    // TODO: verify HMAC-SHA512 checksum với VNPay secret key (production)

    // Idempotent: kiểm tra transaction đã xử lý chưa
    const existing = await this.repo.findInvoiceByVNPayRef(vnpTransactionNo);
    if (existing) {
      return { RspCode: '00', Message: 'Confirm Success' };
    }

    if (vnpResponseCode !== '00') {
      console.log(`[VNPay] Giao dịch ${vnpTxnRef} thất bại — ResponseCode: ${vnpResponseCode}`);
      return { RspCode: '00', Message: 'Confirm Success' };
    }

    // Tìm invoice theo invoiceCode = vnp_TxnRef
    const invoice = await Invoice.findOne({ invoiceCode: vnpTxnRef });
    if (!invoice) {
      return { RspCode: '01', Message: 'Invoice not found' };
    }

    if (!['unpaid', 'partial', 'overdue'].includes(invoice.status)) {
      return { RspCode: '02', Message: 'Invoice already paid' };
    }

    const payment = await this.repo.createPayment({
      branchId: invoice.branchId,
      invoiceId: invoice._id as Types.ObjectId,
      studentId: invoice.studentId,
      paymentMethod: 'vnpay',
      amount: invoice.totalAmount,
      status: 'success',
      vnpayRef: vnpTransactionNo,
      vnpayData: body,
    });

    await this.repo.updateInvoiceVNPay(
      invoice,
      payment._id as Types.ObjectId,
      vnpTransactionNo,
      vnpTransactionNo
    );

    await this.repo.createAuditLog({
      action: 'CONFIRM_PAYMENT',
      actorId: invoice.studentId,
      actorRole: 'parent',
      branchId: invoice.branchId,
      targetId: invoice._id as Types.ObjectId,
      before: { status: invoice.status },
      after: { status: 'paid', method: 'vnpay' },
    });

    // TODO: Emit socket event invoice:paid:{invoiceId}
    console.log(`[Socket] invoice:paid:${invoice._id}`);

    return { RspCode: '00', Message: 'Confirm Success' };
  }

  // 12.8 VNPay Return — redirect FE
  async vnpayReturn(query: any) {
    const vnpResponseCode = query.vnp_ResponseCode;
    const vnpTxnRef = query.vnp_TxnRef;
    const status = vnpResponseCode === '00' ? 'success' : 'failed';
    return { status, invoice_code: vnpTxnRef };
  }
}

// Import Invoice trực tiếp cho vnpayWebhook (tránh qua repo vì cần Mongoose Document)
import { Invoice } from '../../models/invoice.model.js';
