import crypto from 'node:crypto';
import { Types } from 'mongoose';
import qs from 'qs';
import { env } from '../../config/env.validation.js';
import { FinanceRepository } from './finance.repository.js';
import { ROLES } from '../../shared/constants/roles.js';
import { getPagination, getPaginationMeta } from '../../shared/constants/pagination.helper.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} from '../../shared/errors/AllErrors.js';
import {
  getRelatedParentIds,
  NOTIFICATION_TYPES,
  sendNotifications,
} from '../../shared/utils/notification.helper.js';
import {
  formatVnpayDate,
  sortVnpayParams,
  verifyVnpayChecksum,
  type VnpayParams,
} from '../../shared/utils/vnpay.helper.js';
import { IInvoice } from '../../models/invoice.model.js';
import { IPayment } from '../../models/payment.model.js';
import { IUser } from '../../models/user.model.js';
import { IClass } from '../../models/class.model.js';
import { IBranch } from '../../models/branch.model.js';

type InvoicePayload = AppPayload & {
  student_id: string;
  class_id: string;
  billing_period: string;
};

type BatchInvoicePayload = AppPayload & {
  branch_id?: string;
  class_id?: string;
  billing_period: string;
};

type CashPaymentPayload = AppPayload & {
  amount: number;
};

const VNPAY_RESPONSE_MESSAGES: Record<string, string> = {
  '00': 'Giao dịch thành công',
  '07': 'Giao dịch bị nghi ngờ gian lận',
  '09': 'Thẻ hoặc tài khoản chưa đăng ký Internet Banking',
  '10': 'Xác thực giao dịch không thành công quá số lần quy định',
  '11': 'Giao dịch đã hết hạn thanh toán',
  '12': 'Thẻ hoặc tài khoản bị khóa',
  '13': 'Nhập sai mật khẩu xác thực giao dịch',
  '24': 'Khách hàng đã hủy giao dịch',
  '51': 'Tài khoản không đủ số dư',
  '65': 'Tài khoản vượt quá hạn mức giao dịch trong ngày',
  '75': 'Ngân hàng thanh toán đang bảo trì',
  '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định',
  '99': 'Giao dịch không thành công do lỗi khác',
};

const VNPAY_TRANSACTION_STATUS_MESSAGES: Record<string, string> = {
  '00': 'Giao dịch thanh toán thành công',
  '01': 'Giao dịch chưa hoàn tất',
  '02': 'Giao dịch bị lỗi',
  '04': 'Giao dịch đảo một phần',
  '05': 'Giao dịch đang xử lý hoàn tiền',
  '06': 'Giao dịch đã hoàn tiền',
  '07': 'Giao dịch bị nghi ngờ gian lận',
  '09': 'Giao dịch bị từ chối',
};

export class FinanceService {
  private repo: FinanceRepository;

  constructor() {
    this.repo = new FinanceRepository();
  }

  private checkAdminAccess(branchId: string, requester: RequestUser) {
    if (requester.role === ROLES.SYSTEM_OWNER) return;
    if (requester.branchId !== branchId) throw new ForbiddenError('Không thuộc cơ sở của bạn');
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  private getRemainingAmount(invoice: Pick<IInvoice, 'totalAmount' | 'paidAmount'>) {
    return Math.max(0, (invoice.totalAmount ?? 0) - (invoice.paidAmount ?? 0));
  }

  private getVnpayConfig() {
    if (!env.VNPAY_TMN_CODE || !env.VNPAY_HASH_SECRET) {
      throw new BadRequestError(
        'Chưa cấu hình VNPAY_TMN_CODE hoặc VNPAY_HASH_SECRET cho môi trường sandbox'
      );
    }

    return {
      tmnCode: env.VNPAY_TMN_CODE.trim(),
      hashSecret: env.VNPAY_HASH_SECRET.trim(),
      paymentUrl: env.VNPAY_PAYMENT_URL,
      returnUrl: env.VNPAY_RETURN_URL ?? `${env.APP_URL}/api/v1/invoices/vnpay/return`,
      ipnUrl: env.VNPAY_IPN_URL,
      frontendUrl: env.FRONTEND_URL,
      defaultBankCode: env.VNPAY_DEFAULT_BANK_CODE.trim(),
    };
  }

  private normalizeIpAddress(ip?: string) {
    if (!ip || ip === '::1' || ip === '::ffff:127.0.0.1') return '127.0.0.1';
    if (ip.includes(',')) return ip.split(',')[0].trim();
    if (ip.startsWith('::ffff:')) return ip.slice(7);
    return ip;
  }

  private buildVnpayTxnRef(invoiceId: string) {
    return `LCMS${Date.now()}${invoiceId.slice(-8)}`.slice(0, 100);
  }

  private normalizeVnpayText(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 255);
  }

  private getStoredReturnUrl(payment: IPayment) {
    const vnpayData = payment.vnpayData ?? {};
    const storedReturnUrl = vnpayData.returnUrl ?? vnpayData.return_url;
    return (
      (typeof storedReturnUrl === 'string' ? storedReturnUrl : undefined) ??
      `${env.FRONTEND_URL}/student/finance`
    );
  }

  private async assertStudentClassScope(student: IUser, cls: IClass) {
    if (student.branchId?.toString() !== cls.branchId.toString()) {
      throw new ForbiddenError('Học sinh và lớp học không thuộc cùng một cơ sở');
    }
    const enrollment = await this.repo.findActiveEnrollment(
      student._id.toString(),
      cls._id.toString()
    );
    if (!enrollment) {
      throw new BadRequestError('Học sinh chưa được xếp vào lớp học này');
    }
  }

  private getVnpayResponseMessage(code: string) {
    return VNPAY_RESPONSE_MESSAGES[code] ?? `VNPay trả về mã lỗi ${code || 'không xác định'}`;
  }

  private getVnpayTransactionStatusMessage(code: string) {
    return (
      VNPAY_TRANSACTION_STATUS_MESSAGES[code] ??
      `Trạng thái giao dịch VNPay ${code || 'không xác định'}`
    );
  }

  private getVnpayOutcome(params: VnpayParams) {
    const responseCode = String(params.vnp_ResponseCode ?? '');
    const transactionStatus = String(params.vnp_TransactionStatus ?? responseCode);
    const responseMessage = this.getVnpayResponseMessage(responseCode);
    const transactionStatusMessage = this.getVnpayTransactionStatusMessage(transactionStatus);
    const isSuccess = responseCode === '00' && transactionStatus === '00';

    return {
      responseCode,
      transactionStatus,
      responseMessage,
      transactionStatusMessage,
      isSuccess,
      userMessage: isSuccess
        ? 'Thanh toán VNPay thành công'
        : `Thanh toán VNPay thất bại: ${responseMessage}`,
    };
  }

  private buildVnpayResultData(params: VnpayParams, extra: VnpayStoredData = {}) {
    const outcome = this.getVnpayOutcome(params);
    return {
      ...params,
      ...extra,
      responseCode: outcome.responseCode,
      responseMessage: outcome.responseMessage,
      transactionStatus: outcome.transactionStatus,
      transactionStatusMessage: outcome.transactionStatusMessage,
      transactionNo: params.vnp_TransactionNo ?? null,
      bankCode: params.vnp_BankCode ?? null,
      bankTranNo: params.vnp_BankTranNo ?? null,
      cardType: params.vnp_CardType ?? null,
      payDate: params.vnp_PayDate ?? null,
    };
  }

  private async finalizeVnpayPayment(payment: IPayment, params: VnpayParams) {
    const transactionNo = String(params.vnp_TransactionNo ?? '');
    const outcome = this.getVnpayOutcome(params);
    const invoice = await this.repo.findInvoiceById(payment.invoiceId.toString());

    if (!invoice) {
      await this.repo.updatePaymentVNPayResult(
        payment,
        'failed',
        this.buildVnpayResultData(params, {
          failureReason: 'invoice_not_found',
          failureMessage: 'Không tìm thấy hóa đơn liên kết với giao dịch',
        })
      );
      return { rspCode: '01', message: 'Invoice not found' };
    }

    const vnpAmount = Number(params.vnp_Amount ?? 0) / 100;
    if (vnpAmount !== payment.amount) {
      await this.repo.updatePaymentVNPayResult(
        payment,
        'failed',
        this.buildVnpayResultData(params, {
          failureReason: 'invalid_amount',
          failureMessage: `Số tiền VNPay trả về ${this.formatCurrency(vnpAmount)} không khớp giao dịch ${this.formatCurrency(payment.amount)}`,
        })
      );
      return { rspCode: '04', message: 'Invalid amount' };
    }

    if (transactionNo) {
      const existing = await this.repo.findInvoiceByVNPayRef(transactionNo);
      if (existing) {
        return { rspCode: '00', message: 'Confirm Success', invoice };
      }
    }

    if (payment.status === 'success' || invoice.status === 'paid') {
      return { rspCode: '02', message: 'Order already confirmed', invoice };
    }

    if (!outcome.isSuccess) {
      await this.repo.updatePaymentVNPayResult(
        payment,
        'failed',
        this.buildVnpayResultData(params, {
          failureReason: 'vnpay_response',
          failureMessage: outcome.userMessage,
        })
      );
      return { rspCode: '00', message: 'Confirm Success', invoice };
    }

    const updatedPayment = await this.repo.updatePaymentVNPayResult(
      payment,
      'success',
      this.buildVnpayResultData(params)
    );
    const updatedInvoice = await this.repo.updateInvoiceVNPay(
      invoice,
      updatedPayment._id as Types.ObjectId,
      transactionNo,
      transactionNo
    );

    await this.repo.createAuditLog({
      action: 'CONFIRM_PAYMENT',
      actorId: invoice.studentId,
      actorRole: 'student',
      branchId: invoice.branchId,
      targetId: invoice._id as Types.ObjectId,
      before: { status: invoice.status },
      after: { status: updatedInvoice.status, method: 'vnpay', transactionNo },
    });

    await this.notifyPaymentConfirmed(updatedInvoice, updatedPayment.amount);

    return { rspCode: '00', message: 'Confirm Success', invoice: updatedInvoice };
  }

  private async calculateInvoiceAmount(
    body: InvoicePayload,
    student: IUser,
    cls: IClass,
    branch: IBranch
  ) {
    const invoiceType = body.invoice_type ?? (cls.classType === 'course' ? 'course' : 'monthly');
    const sessionsAttended =
      body.sessions_attended ??
      (await this.repo.countPresentSessions(body.student_id, body.class_id, body.billing_period));
    const sessionsTotal = body.sessions_total ?? cls.courseInfo?.totalSessions ?? undefined;
    const feePerSession =
      body.fee_per_session ?? cls.ongoingInfo?.feePerSession ?? branch.defaultFeePerSession ?? 0;
    const courseFee = body.course_fee ?? cls.courseInfo?.feePerCourse ?? 0;
    const subtotal =
      invoiceType === 'course' && courseFee > 0 ? courseFee : sessionsAttended * feePerSession;
    const discountAmount = body.discount_amount ?? 0;
    const totalAmount = Math.max(0, subtotal - discountAmount);

    return {
      student_id: body.student_id,
      class_id: body.class_id,
      student: {
        _id: student._id,
        full_name: student.fullName,
        user_code: student.userCode ?? null,
      },
      class: {
        _id: cls._id,
        name: cls.name,
        subject_name: cls.subject?.name ?? '',
        class_type: cls.classType,
      },
      invoice_type: invoiceType,
      billing_period: body.billing_period,
      sessions_attended: sessionsAttended,
      sessions_total: sessionsTotal,
      fee_per_session: feePerSession,
      course_fee: courseFee,
      subtotal: subtotal,
      discount_amount: discountAmount,
      discount_note: body.discount_note ?? null,
      total_amount: totalAmount,
      due_date: body.due_date ? new Date(body.due_date) : null,
    };
  }

  private async notifyInvoiceDue(invoice: IInvoice, student: IUser, requesterId?: string) {
    const parentIds = await getRelatedParentIds([invoice.studentId]);
    await sendNotifications([invoice.studentId, ...parentIds], {
      branchId: invoice.branchId,
      type: NOTIFICATION_TYPES.INVOICE_DUE,
      title: `Phiếu học phí ${invoice.invoiceCode}`,
      content: `Phiếu học phí kỳ ${invoice.billingPeriod} của ${student.fullName} có số tiền ${this.formatCurrency(invoice.totalAmount)}.`,
      actionUrl: '/student/finance',
      metadata: {
        invoiceId: invoice._id.toString(),
        invoiceCode: invoice.invoiceCode,
        billingPeriod: invoice.billingPeriod,
        totalAmount: invoice.totalAmount,
      },
      excludeUserIds: requesterId ? [requesterId] : [],
    });
  }

  private async notifyPaymentConfirmed(invoice: IInvoice, amount: number, requesterId?: string) {
    const parentIds = await getRelatedParentIds([invoice.studentId]);
    await sendNotifications([invoice.studentId, ...parentIds], {
      branchId: invoice.branchId,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: `Đã xác nhận thanh toán ${invoice.invoiceCode}`,
      content: `Trung tâm đã ghi nhận ${this.formatCurrency(amount)} cho phiếu học phí ${invoice.invoiceCode}.`,
      actionUrl: '/student/finance',
      metadata: {
        invoiceId: invoice._id.toString(),
        invoiceCode: invoice.invoiceCode,
        paidAmount: amount,
        status: invoice.status,
      },
      excludeUserIds: requesterId ? [requesterId] : [],
    });
  }

  private getCourseBillingPeriod(cls: IClass) {
    const sourceDate = cls.startDate ?? cls.courseInfo?.startDate ?? new Date();
    const date = new Date(sourceDate);
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const month = String(safeDate.getMonth() + 1).padStart(2, '0');
    return `${safeDate.getFullYear()}-${month}`;
  }

  async createCourseInvoiceForEnrollment(
    studentId: string,
    classId: string,
    requester: RequestUser
  ) {
    const student = await this.repo.findStudentById(studentId);
    if (!student || student.role !== ROLES.STUDENT) throw new NotFoundError('Học sinh');

    const cls = await this.repo.findClassById(classId);
    if (!cls) throw new NotFoundError('Lớp học');
    if (cls.classType !== 'course') return null;

    this.checkAdminAccess(cls.branchId.toString(), requester);
    await this.assertStudentClassScope(student, cls);

    const branch = await this.repo.findBranchById(cls.branchId.toString());
    if (!branch) throw new NotFoundError('Cơ sở');

    const billingPeriod = this.getCourseBillingPeriod(cls);
    const existing = await this.repo.findExistingInvoice(studentId, classId, billingPeriod);
    if (existing) return existing;

    const calculation = await this.calculateInvoiceAmount(
      {
        student_id: studentId,
        class_id: classId,
        invoice_type: 'course',
        billing_period: billingPeriod,
        sessions_attended: 0,
        sessions_total: cls.courseInfo?.totalSessions ?? undefined,
        course_fee: cls.courseInfo?.feePerCourse ?? 0,
        discount_amount: 0,
      },
      student,
      cls,
      branch
    );
    const invoiceCode = await this.repo.generateInvoiceCode(branch.branchCode);

    const invoice = await this.repo.createInvoice({
      branchId: cls.branchId,
      studentId: new Types.ObjectId(studentId),
      classId: new Types.ObjectId(classId),
      studentSnapshot: { fullName: student.fullName, studentCode: student.userCode ?? undefined },
      classSnapshot: { name: cls.name, subjectName: cls.subject?.name ?? '' },
      invoiceCode,
      invoiceType: 'course',
      billingPeriod,
      sessionsAttended: calculation.sessions_attended,
      sessionsTotal: calculation.sessions_total,
      feePerSession: calculation.fee_per_session,
      courseFee: calculation.course_fee,
      subtotal: calculation.subtotal,
      discountAmount: 0,
      totalAmount: calculation.total_amount,
      status: 'unpaid',
      generationType: 'auto',
      note: 'Tự động tạo khi học sinh được thêm vào khóa học',
      createdBy: new Types.ObjectId(requester.id),
    });

    await this.repo.createAuditLog({
      action: 'CHANGE_INVOICE',
      actorId: new Types.ObjectId(requester.id),
      actorRole: requester.role,
      branchId: cls.branchId,
      targetId: invoice._id as Types.ObjectId,
      after: { invoiceCode, totalAmount: calculation.total_amount, status: 'unpaid' },
    });

    await this.notifyInvoiceDue(invoice, student, requester.id);
    return invoice;
  }

  // 12.1 Tạo phiếu học phí thủ công
  async createInvoice(body: InvoicePayload, requester: RequestUser) {
    const student = await this.repo.findStudentById(body.student_id);
    if (!student || student.role !== ROLES.STUDENT) throw new NotFoundError('Học sinh');

    const cls = await this.repo.findClassById(body.class_id);
    if (!cls) throw new NotFoundError('Lớp học');

    this.checkAdminAccess(cls.branchId.toString(), requester);
    await this.assertStudentClassScope(student, cls);

    const branch = await this.repo.findBranchById(cls.branchId.toString());
    if (!branch) throw new NotFoundError('Cơ sở');

    // Idempotent: kiểm tra đã có phiếu chưa
    const existing = await this.repo.findExistingInvoice(
      body.student_id,
      body.class_id,
      body.billing_period
    );
    if (existing) throw new ConflictError('Đã có phiếu học phí cho học sinh này trong kỳ đó');

    const calculation = await this.calculateInvoiceAmount(body, student, cls, branch);
    const invoiceCode = await this.repo.generateInvoiceCode(branch.branchCode);

    const invoice = await this.repo.createInvoice({
      branchId: cls.branchId,
      studentId: new Types.ObjectId(body.student_id),
      classId: new Types.ObjectId(body.class_id),
      studentSnapshot: { fullName: student.fullName, studentCode: student.userCode ?? undefined },
      classSnapshot: { name: cls.name, subjectName: cls.subject?.name ?? '' },
      invoiceCode,
      invoiceType: calculation.invoice_type,
      billingPeriod: calculation.billing_period,
      sessionsAttended: calculation.sessions_attended,
      sessionsTotal: calculation.sessions_total,
      feePerSession: calculation.fee_per_session,
      courseFee: calculation.course_fee,
      subtotal: calculation.subtotal,
      discountAmount: calculation.discount_amount,
      discountNote: body.discount_note,
      totalAmount: calculation.total_amount,
      dueDate: body.due_date ? new Date(body.due_date) : undefined,
      status: 'unpaid',
      generationType: 'manual',
      note: body.note,
      createdBy: new Types.ObjectId(requester.id),
    });

    await this.repo.createAuditLog({
      action: 'CHANGE_INVOICE',
      actorId: new Types.ObjectId(requester.id),
      actorRole: requester.role,
      branchId: cls.branchId,
      targetId: invoice._id as Types.ObjectId,
      after: { invoiceCode, totalAmount: calculation.total_amount, status: 'unpaid' },
    });

    await this.notifyInvoiceDue(invoice, student, requester.id);

    return {
      _id: invoice._id,
      invoice_code: invoice.invoiceCode,
      student_id: body.student_id,
      billing_period: invoice.billingPeriod,
      sessions_attended: invoice.sessionsAttended,
      sessions_total: invoice.sessionsTotal,
      fee_per_session: invoice.feePerSession,
      course_fee: invoice.courseFee,
      subtotal: invoice.subtotal,
      discount_amount: invoice.discountAmount,
      total_amount: invoice.totalAmount,
      paid_amount: invoice.paidAmount ?? 0,
      remaining_amount: this.getRemainingAmount(invoice),
      status: invoice.status,
      due_date: invoice.dueDate,
      generation_type: invoice.generationType,
    };
  }

  // 12.1b Tính thử học phí
  async calculateInvoice(body: InvoicePayload, requester: RequestUser) {
    const student = await this.repo.findStudentById(body.student_id);
    if (!student || student.role !== ROLES.STUDENT) throw new NotFoundError('Học sinh');

    const cls = await this.repo.findClassById(body.class_id);
    if (!cls) throw new NotFoundError('Lớp học');

    this.checkAdminAccess(cls.branchId.toString(), requester);
    await this.assertStudentClassScope(student, cls);

    const branch = await this.repo.findBranchById(cls.branchId.toString());
    if (!branch) throw new NotFoundError('Cơ sở');

    return this.calculateInvoiceAmount(body, student, cls, branch);
  }

  // 12.2 Batch generate phiếu học phí
  async batchGenerateInvoices(body: BatchInvoicePayload, requester: RequestUser) {
    const targetClass = body.class_id ? await this.repo.findClassById(body.class_id) : null;
    if (body.class_id && !targetClass) throw new NotFoundError('Lớp học');
    if (targetClass?.classType === 'course') {
      throw new BadRequestError('Chỉ có thể tính học phí theo tháng cho lớp thường xuyên');
    }

    const branchId =
      targetClass?.branchId.toString() ??
      (requester.role === ROLES.SYSTEM_OWNER ? body.branch_id : requester.branchId);
    if (!branchId) throw new BadRequestError('Vui lòng chọn cơ sở hoặc lớp cần tính học phí');

    if (targetClass && targetClass.branchId.toString() !== branchId) {
      throw new ForbiddenError('Lớp học không thuộc cơ sở cần tính học phí');
    }

    const branch = await this.repo.findBranchById(branchId);
    if (!branch) throw new NotFoundError('Cơ sở');
    this.checkAdminAccess(branchId, requester);

    const enrollments = targetClass
      ? await this.repo.findActiveEnrollmentsByClass(targetClass._id.toString(), branchId)
      : await this.repo.findActiveEnrollmentsByBranch(branchId);

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const enrollment of enrollments) {
      try {
        const studentId = enrollment.studentId.toString();
        const classId = enrollment.classId.toString();

        // Skip nếu đã có phiếu
        const exists = await this.repo.findExistingInvoice(
          studentId,
          classId,
          body.billing_period
        );
        if (exists) {
          skipped++;
          continue;
        }

        const sessionsAttended = await this.repo.countPresentSessions(
          studentId,
          classId,
          body.billing_period
        );
        if (sessionsAttended === 0) {
          skipped++;
          continue;
        }

        const cls = targetClass && targetClass._id.toString() === classId
          ? targetClass
          : await this.repo.findClassById(classId);
        if (!cls || cls.branchId.toString() !== branchId) {
          skipped++;
          continue;
        }
        if (cls.classType === 'course') {
          skipped++;
          continue;
        }

        const student = await this.repo.findStudentById(studentId);
        if (!student || student.branchId?.toString() !== branchId) {
          skipped++;
          continue;
        }

        const feePerSession = cls.ongoingInfo?.feePerSession ?? branch.defaultFeePerSession ?? 0;
        const subtotal = sessionsAttended * feePerSession;
        const invoiceCode = await this.repo.generateInvoiceCode(branch.branchCode);

        const invoice = await this.repo.createInvoice({
          branchId: new Types.ObjectId(branchId),
          studentId: enrollment.studentId,
          classId: enrollment.classId,
          studentSnapshot: {
            fullName: student.fullName,
            studentCode: student.userCode ?? undefined,
          },
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
          createdBy: new Types.ObjectId(requester.id),
        });

        await this.notifyInvoiceDue(invoice, student, requester.id);

        generated++;
      } catch {
        failed++;
      }
    }

    const [yearStr, monthStr] = body.billing_period.split('-');
    return {
      generated,
      skipped,
      failed,
      message: `Đã tạo ${generated} phiếu học phí tháng ${monthStr}/${yearStr}`,
    };
  }

  // 12.3 Lấy danh sách phiếu học phí
  async getInvoices(query: AppQuery, requester: RequestUser) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: MongoFilter<IInvoice> = { deletedAt: null };

    // RBAC
    if (requester.role === ROLES.PARENT) {
      const { User } = await import('../../models/user.model.js');
      const parent = await User.findById(requester.id).lean();
      const childIds = (parent?.parentInfo?.studentIds ?? []).map((id: Types.ObjectId | string) =>
        String(id)
      );
      if (query.student_id) {
        if (!childIds.includes(String(query.student_id))) {
          throw new ForbiddenError('Đây không phải phiếu học phí của con bạn');
        }
        filter.studentId = new Types.ObjectId(query.student_id);
      } else {
        filter.studentId = { $in: childIds.map((id: string) => new Types.ObjectId(id)) };
      }
      filter.branchId = new Types.ObjectId(requester.branchId);
    } else if (requester.role === ROLES.STUDENT) {
      if (query.student_id && String(query.student_id) !== requester.id) {
        throw new ForbiddenError('Bạn chỉ được xem phiếu học phí của mình');
      }
      filter.studentId = new Types.ObjectId(requester.id);
      filter.branchId = new Types.ObjectId(requester.branchId);
    } else if (requester.role !== ROLES.SYSTEM_OWNER) {
      filter.branchId = new Types.ObjectId(requester.branchId);
      if (query.student_id) filter.studentId = new Types.ObjectId(query.student_id);
    }

    if (query.branch_id && requester.role === ROLES.SYSTEM_OWNER) {
      filter.branchId = new Types.ObjectId(query.branch_id);
    }
    if (query.student_id && requester.role === ROLES.SYSTEM_OWNER) {
      filter.studentId = new Types.ObjectId(query.student_id);
    }
    if (query.status) filter.status = query.status;
    if (query.billing_period) filter.billingPeriod = query.billing_period;
    const invoiceType = String(query.invoice_type ?? query.class_type ?? '');
    if (invoiceType === 'course') filter.invoiceType = 'course';
    if (invoiceType === 'ongoing' || invoiceType === 'monthly') filter.invoiceType = 'monthly';
    if (query.due_date_before) filter.dueDate = { $lte: new Date(query.due_date_before) };

    const { items, total, totalAmount } = await this.repo.findInvoices(filter, skip, limit);

    const data = items.map(inv => ({
      _id: inv._id,
      invoice_code: inv.invoiceCode,
      student: {
        _id: (inv.studentId as PopulatedUserSummary)._id ?? inv.studentId,
        full_name: (inv.studentId as PopulatedUserSummary).fullName ?? null,
        user_code: (inv.studentId as PopulatedUserSummary).userCode ?? null,
      },
      class: {
        _id: (inv.classId as PopulatedClassSummary)._id ?? inv.classId,
        name: (inv.classId as PopulatedClassSummary).name ?? null,
        class_type: (inv.classId as PopulatedClassSummary).classType ?? null,
      },
      invoice_type: inv.invoiceType,
      billing_period: inv.billingPeriod,
      sessions_attended: inv.sessionsAttended,
      sessions_total: inv.sessionsTotal,
      fee_per_session: inv.feePerSession,
      course_fee: inv.courseFee,
      subtotal: inv.subtotal,
      discount_amount: inv.discountAmount,
      total_amount: inv.totalAmount,
      paid_amount: inv.paidAmount ?? 0,
      remaining_amount: Math.max(0, (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0)),
      status: inv.status,
      due_date: inv.dueDate,
      paid_at: inv.paidAt,
      payment_method: inv.paymentMethod,
      created_at: inv.createdAt,
    }));

    return {
      data,
      meta: { ...getPaginationMeta(total, page, limit), total_amount: totalAmount },
    };
  }

  // 12.4 Lấy chi tiết phiếu học phí
  async getInvoiceById(id: string, requester: RequestUser) {
    const invoice = await this.repo.findInvoiceById(id);
    if (!invoice) throw new NotFoundError('Phiếu học phí');

    if (requester.role === ROLES.PARENT) {
      const { User } = await import('../../models/user.model.js');
      const parent = await User.findById(requester.id).lean();
      const childIds = parent?.parentInfo?.studentIds?.map(String) ?? [];
      if (!childIds.includes(invoice.studentId.toString())) {
        throw new ForbiddenError('Đây không phải phiếu học phí của con bạn');
      }
      if (invoice.branchId.toString() !== requester.branchId) {
        throw new ForbiddenError('Phiếu học phí không thuộc cơ sở của bạn');
      }
    } else if (requester.role === ROLES.STUDENT) {
      if (invoice.studentId.toString() !== requester.id) {
        throw new ForbiddenError('Bạn chỉ được xem phiếu học phí của mình');
      }
      if (invoice.branchId.toString() !== requester.branchId) {
        throw new ForbiddenError('Phiếu học phí không thuộc cơ sở của bạn');
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
      invoice_type: invoice.invoiceType,
      billing_period: invoice.billingPeriod,
      sessions_attended: invoice.sessionsAttended,
      sessions_total: invoice.sessionsTotal,
      fee_per_session: invoice.feePerSession,
      course_fee: invoice.courseFee,
      subtotal: invoice.subtotal,
      discount_amount: invoice.discountAmount,
      discount_note: invoice.discountNote,
      total_amount: invoice.totalAmount,
      paid_amount: invoice.paidAmount ?? 0,
      remaining_amount: this.getRemainingAmount(invoice),
      status: invoice.status,
      due_date: invoice.dueDate,
      paid_at: invoice.paidAt,
      payment_method: invoice.paymentMethod,
      note: invoice.note,
      payment_ids: invoice.paymentIds,
    };
  }

  async deleteInvoice(id: string, requester: RequestUser) {
    const invoice = await this.repo.findInvoiceById(id);
    if (!invoice) throw new NotFoundError('Phiếu học phí');

    this.checkAdminAccess(invoice.branchId.toString(), requester);

    if (invoice.status === 'paid' || invoice.status === 'partial' || (invoice.paidAmount ?? 0) > 0) {
      throw new BadRequestError('Không thể xóa phiếu đã phát sinh khoản thu');
    }
    if (await this.repo.hasActivePayments(id)) {
      throw new BadRequestError('Không thể xóa phiếu đang có giao dịch thanh toán');
    }

    await this.repo.softDeleteInvoice(id);
    await this.repo.createAuditLog({
      action: 'CANCEL_INVOICE',
      actorId: new Types.ObjectId(requester.id),
      actorRole: requester.role,
      branchId: invoice.branchId,
      targetId: invoice._id as Types.ObjectId,
      before: { status: invoice.status, deletedAt: invoice.deletedAt ?? null },
      after: { status: 'cancelled', deletedAt: new Date() },
    });

    return { invoice_id: id, deleted: true };
  }

  // 12.4b Lịch sử giao dịch
  async getPayments(query: AppQuery, requester: RequestUser) {
    const { page, limit, skip } = getPagination(query.page, query.limit);
    const filter: MongoFilter<IPayment> = {};

    if (requester.role === ROLES.PARENT) {
      const { User } = await import('../../models/user.model.js');
      const parent = await User.findById(requester.id).lean();
      const childIds = (parent?.parentInfo?.studentIds ?? []).map((id: Types.ObjectId | string) =>
        String(id)
      );

      if (query.student_id) {
        if (!childIds.includes(String(query.student_id))) {
          throw new ForbiddenError('Đây không phải giao dịch của con bạn');
        }
        filter.studentId = new Types.ObjectId(String(query.student_id));
      } else {
        filter.studentId = { $in: childIds.map((id: string) => new Types.ObjectId(id)) };
      }
      filter.branchId = new Types.ObjectId(requester.branchId);
    } else if (requester.role === ROLES.STUDENT) {
      if (query.student_id && String(query.student_id) !== requester.id) {
        throw new ForbiddenError('Bạn chỉ được xem giao dịch của mình');
      }
      filter.studentId = new Types.ObjectId(requester.id);
      filter.branchId = new Types.ObjectId(requester.branchId);
    } else if (requester.role !== ROLES.SYSTEM_OWNER) {
      filter.branchId = new Types.ObjectId(requester.branchId);
      if (query.student_id) filter.studentId = new Types.ObjectId(String(query.student_id));
    }

    if (requester.role === ROLES.SYSTEM_OWNER) {
      if (query.branch_id) filter.branchId = new Types.ObjectId(String(query.branch_id));
      if (query.student_id) filter.studentId = new Types.ObjectId(String(query.student_id));
    }

    if (query.invoice_id) filter.invoiceId = new Types.ObjectId(String(query.invoice_id));
    if (query.status) filter.status = String(query.status);
    if (query.payment_method) filter.paymentMethod = String(query.payment_method);

    const { items, total } = await this.repo.findPayments(filter, skip, limit);

    const data = items.map(payment => {
      const invoice = payment.invoiceId as unknown as {
        _id?: Types.ObjectId;
        invoiceCode?: string;
        billingPeriod?: string;
        status?: string;
      };
      const student = payment.studentId as unknown as PopulatedUserSummary;
      const vnpayData = payment.vnpayData ?? {};

      return {
        _id: payment._id,
        invoice_id: invoice?._id ?? payment.invoiceId,
        invoice_code: invoice?.invoiceCode ?? vnpayData.invoiceCode ?? '',
        invoice_status: invoice?.status ?? '',
        billing_period: invoice?.billingPeriod ?? '',
        student: {
          _id: student?._id ?? payment.studentId,
          full_name: student?.fullName ?? null,
          user_code: student?.userCode ?? null,
        },
        payment_method: payment.paymentMethod,
        amount: payment.amount,
        status: payment.status,
        received_at: payment.receivedAt,
        created_at: payment.createdAt,
        vnpay_ref: payment.vnpayRef,
        vnpay_transaction_no: vnpayData.transactionNo ?? vnpayData.vnp_TransactionNo ?? null,
        vnpay_response_code: vnpayData.responseCode ?? vnpayData.vnp_ResponseCode ?? null,
        vnpay_response_message: vnpayData.responseMessage ?? null,
        vnpay_transaction_status:
          vnpayData.transactionStatus ?? vnpayData.vnp_TransactionStatus ?? null,
        vnpay_transaction_message: vnpayData.transactionStatusMessage ?? null,
        failure_reason: vnpayData.failureReason ?? null,
        failure_message: vnpayData.failureMessage ?? null,
      };
    });

    return {
      data,
      meta: getPaginationMeta(total, page, limit),
    };
  }

  // 12.5 Thu tiền mặt
  async payCash(id: string, body: CashPaymentPayload, requester: RequestUser) {
    const invoice = await this.repo.findInvoiceById(id);
    if (!invoice) throw new NotFoundError('Phiếu học phí');

    this.checkAdminAccess(invoice.branchId.toString(), requester);

    if (!['unpaid', 'partial', 'overdue'].includes(invoice.status)) {
      throw new BadRequestError(
        `Phiếu học phí đang ở trạng thái ${invoice.status}, không thể thu tiền`
      );
    }

    const before = { status: invoice.status, paidAmount: invoice.paidAmount };
    const remainingAmount = this.getRemainingAmount(invoice);
    if (body.amount > remainingAmount) {
      throw new BadRequestError(
        `Số tiền thu vượt quá số còn phải thanh toán ${this.formatCurrency(remainingAmount)}`
      );
    }

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

    await this.notifyPaymentConfirmed(updated, body.amount, requester.id);

    return {
      invoice_id: id,
      status: updated.status,
      paid_amount: updated.paidAmount,
      remaining_amount: this.getRemainingAmount(updated),
      payment: {
        _id: payment._id,
        payment_method: 'cash',
        amount: body.amount,
        received_by: requester.id,
        received_at: payment.createdAt,
      },
    };
  }

  // 12.6 Tạo link thanh toán VNPay sandbox
  async vnpayCreatePayment(id: string, body: AppPayload, requester: RequestUser) {
    const vnpayConfig = this.getVnpayConfig();
    const invoice = await this.repo.findInvoiceById(id);
    if (!invoice) throw new NotFoundError('Phiếu học phí');

    if (requester.role === ROLES.PARENT) {
      const { User } = await import('../../models/user.model.js');
      const parent = await User.findById(requester.id).lean();
      const childIds = parent?.parentInfo?.studentIds?.map(String) ?? [];
      if (!childIds.includes(invoice.studentId.toString())) {
        throw new ForbiddenError('Đây không phải phiếu học phí của con bạn');
      }
      if (invoice.branchId.toString() !== requester.branchId) {
        throw new ForbiddenError('Phiếu học phí không thuộc cơ sở của bạn');
      }
    } else if (requester.role === ROLES.STUDENT) {
      if (invoice.studentId.toString() !== requester.id) {
        throw new ForbiddenError('Bạn chỉ được thanh toán phiếu học phí của mình');
      }
      if (invoice.branchId.toString() !== requester.branchId) {
        throw new ForbiddenError('Phiếu học phí không thuộc cơ sở của bạn');
      }
    } else if (requester.role !== ROLES.SYSTEM_OWNER) {
      this.checkAdminAccess(invoice.branchId.toString(), requester);
    }

    if (!['unpaid', 'partial', 'overdue'].includes(invoice.status)) {
      throw new BadRequestError('Phiếu học phí không ở trạng thái có thể thanh toán');
    }

    const remainingAmount = this.getRemainingAmount(invoice);
    if (remainingAmount <= 0) {
      throw new BadRequestError('Phiếu học phí đã hết số tiền cần thanh toán');
    }

    const vnpAmount = remainingAmount * 100;
    const txnRef = this.buildVnpayTxnRef(invoice._id.toString());
    const now = new Date();
    const expireDate = new Date(now.getTime() + 15 * 60 * 1000);
    const finalReturnUrl = body.return_url || `${vnpayConfig.frontendUrl}/student/finance`;

    await this.repo.createPayment({
      branchId: invoice.branchId,
      invoiceId: invoice._id as Types.ObjectId,
      studentId: invoice.studentId,
      paymentMethod: 'vnpay',
      amount: remainingAmount,
      status: 'pending',
      vnpayRef: txnRef,
      vnpayData: {
        txnRef,
        invoiceCode: invoice.invoiceCode,
        returnUrl: finalReturnUrl,
        createdBy: requester.id,
        createdByRole: requester.role,
      },
    });

    const params: VnpayParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: vnpayConfig.tmnCode,
      vnp_Amount: vnpAmount,
      vnp_CreateDate: formatVnpayDate(now),
      vnp_CurrCode: 'VND',
      vnp_IpAddr: this.normalizeIpAddress(body.ip_addr),
      vnp_Locale: 'vn',
      vnp_OrderInfo: this.normalizeVnpayText(`Thanh toan hoc phi ${invoice.invoiceCode}`),
      vnp_OrderType: 'other',
      vnp_ReturnUrl: vnpayConfig.returnUrl,
      vnp_TxnRef: txnRef,
    };

    const bankCode = typeof body.bank_code === 'string' ? body.bank_code.trim() : '';
    if (bankCode) {
      params.vnp_BankCode = bankCode;
    }

    console.log('[BE][VNPay][create-payment raw params]', params);

    const sortedParams = sortVnpayParams(params);
    const signData = qs.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', vnpayConfig.hashSecret);
    const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    sortedParams.vnp_SecureHash = secureHash;

    const paymentUrl = `${vnpayConfig.paymentUrl}?${qs.stringify(sortedParams, {
      encode: false,
    })}`;

    console.log('[BE][VNPay][create-payment sign data]', signData);
    console.log('[BE][VNPay][create-payment signed query params]', sortedParams);
    console.log('[BE][VNPay][create-payment payment url]', paymentUrl);

    return {
      payment_url: paymentUrl,
      invoice_code: invoice.invoiceCode,
      txn_ref: txnRef,
      amount: remainingAmount,
      expired_at: expireDate,
    };
  }

  // 12.7 VNPay Webhook (IPN)
  async vnpayWebhook(body: VnpayParams) {
    const vnpayConfig = this.getVnpayConfig();
    if (!body.vnp_SecureHash || !verifyVnpayChecksum(body, vnpayConfig.hashSecret)) {
      const payment = await this.repo.findPaymentByVNPayTxnRef(String(body.vnp_TxnRef ?? ''));
      if (payment) {
        await this.repo.updatePaymentVNPayResult(
          payment,
          'failed',
          this.buildVnpayResultData(body, {
            failureReason: 'invalid_checksum',
            failureMessage: 'Chữ ký thanh toán VNPay không hợp lệ',
          })
        );
      }
      return { RspCode: '97', Message: 'Invalid Checksum' };
    }

    const payment = await this.repo.findPaymentByVNPayTxnRef(String(body.vnp_TxnRef ?? ''));
    if (!payment) {
      return { RspCode: '01', Message: 'Invoice not found' };
    }

    const result = await this.finalizeVnpayPayment(payment, body);
    return { RspCode: result.rspCode, Message: result.message };
  }

  // 12.8 VNPay Return — redirect FE
  async vnpayReturn(query: VnpayParams) {
    const vnpayConfig = this.getVnpayConfig();
    const fallbackRedirectUrl = `${vnpayConfig.frontendUrl}/student/finance`;
    const isValidChecksum =
      Boolean(query.vnp_SecureHash) && verifyVnpayChecksum(query, vnpayConfig.hashSecret);

    if (!isValidChecksum) {
      const payment = await this.repo.findPaymentByVNPayTxnRef(String(query.vnp_TxnRef ?? ''));
      if (payment) {
        await this.repo.updatePaymentVNPayResult(
          payment,
          'failed',
          this.buildVnpayResultData(query, {
            failureReason: 'invalid_checksum',
            failureMessage: 'Chữ ký thanh toán VNPay không hợp lệ',
          })
        );
      }

      return {
        status: 'invalid_checksum',
        invoice_code: payment?.vnpayData?.invoiceCode ?? '',
        redirect_url: payment ? this.getStoredReturnUrl(payment) : fallbackRedirectUrl,
        message: 'Chữ ký thanh toán không hợp lệ',
      };
    }

    const payment = await this.repo.findPaymentByVNPayTxnRef(String(query.vnp_TxnRef ?? ''));
    if (!payment) {
      return {
        status: 'not_found',
        invoice_code: '',
        redirect_url: fallbackRedirectUrl,
        message: 'Không tìm thấy giao dịch thanh toán',
      };
    }

    const result = await this.finalizeVnpayPayment(payment, query);
    const outcome = this.getVnpayOutcome(query);
    const isSuccess = result.rspCode === '00' && outcome.isSuccess;

    return {
      status: isSuccess ? 'success' : 'failed',
      invoice_code: result.invoice?.invoiceCode ?? payment.vnpayData?.invoiceCode ?? '',
      redirect_url: this.getStoredReturnUrl(payment),
      message: outcome.userMessage,
      response_code: outcome.responseCode,
      transaction_status: outcome.transactionStatus,
    };
  }
}
