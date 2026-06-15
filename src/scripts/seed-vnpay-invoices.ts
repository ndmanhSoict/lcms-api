import mongoose, { Types } from 'mongoose';
import { env } from '../config/env.validation.js';
import { Class } from '../models/class.model.js';
import { Enrollment } from '../models/enrollment.model.js';
import { Invoice } from '../models/invoice.model.js';
import { Payment } from '../models/payment.model.js';
import { User } from '../models/user.model.js';

const DEFAULT_PARENT_EMAIL = 'ph001@parent.lcms.edu.vn';
const INVOICE_PREFIX = 'VNPAY-TEST';

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

const formatPeriod = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const normalizeCodePart = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const seedVnpayInvoices = async () => {
  const requestedEmail = process.argv[2] || process.env.SEED_PARENT_EMAIL || DEFAULT_PARENT_EMAIL;
  const parentEmail = requestedEmail.trim().toLowerCase();

  try {
    console.log(`Đang kết nối MongoDB để tạo phiếu VNPay cho ${parentEmail}...`);
    await mongoose.connect(env.MONGODB_URI);

    const parent = await User.findOne({
      email: parentEmail,
      role: 'parent',
      isActive: true,
      deletedAt: null,
    }).lean();

    if (!parent) {
      throw new Error(`Không tìm thấy phụ huynh đang hoạt động: ${parentEmail}`);
    }

    const studentIds = parent.parentInfo?.studentIds ?? [];
    if (!studentIds.length) {
      throw new Error(`Phụ huynh ${parentEmail} chưa được liên kết với học sinh`);
    }

    const student = await User.findOne({
      _id: { $in: studentIds },
      role: 'student',
      isActive: true,
      deletedAt: null,
    }).lean();

    if (!student) {
      throw new Error(`Không tìm thấy học sinh đang hoạt động của ${parentEmail}`);
    }

    const enrollment = await Enrollment.findOne({
      studentId: student._id,
      leftAt: null,
    })
      .sort({ enrolledAt: -1 })
      .lean();

    const classId = enrollment?.classId ?? student.studentInfo?.activeClassIds?.[0];

    if (!classId) {
      throw new Error(`Học sinh ${student.fullName} chưa có lớp đang học`);
    }

    const classDoc = await Class.findOne({
      _id: classId,
      branchId: student.branchId,
      deletedAt: null,
    }).lean();

    if (!classDoc) {
      throw new Error(`Không tìm thấy lớp đang học của ${student.fullName}`);
    }

    if (!student.branchId) {
      throw new Error(`Học sinh ${student.fullName} chưa thuộc cơ sở nào`);
    }

    const now = new Date();
    const studentCode = normalizeCodePart(student.userCode || student._id.toString().slice(-8));
    const amounts = [450_000, 750_000, 1_200_000];
    const testInvoices = amounts.map((totalAmount, index) => {
      const period = formatPeriod(addMonths(now, index));
      const invoiceCode = `${INVOICE_PREFIX}-${studentCode}-${period}-${index + 1}`;
      const invoiceType = classDoc.classType === 'course' ? 'course' : 'monthly';
      const feePerSession = classDoc.ongoingInfo?.feePerSession ?? null;
      const sessionsAttended =
        feePerSession && feePerSession > 0
          ? Math.max(1, Math.round(totalAmount / feePerSession))
          : null;

      return {
        invoiceCode,
        data: {
          schemaVersion: 1,
          branchId: student.branchId,
          studentId: student._id,
          classId: classDoc._id,
          studentSnapshot: {
            fullName: student.fullName,
            studentCode: student.userCode ?? null,
          },
          classSnapshot: {
            name: classDoc.name,
            subjectName: classDoc.subject.name,
          },
          invoiceType,
          billingPeriod: period,
          sessionsAttended,
          sessionsTotal: sessionsAttended,
          feePerSession,
          courseFee: invoiceType === 'course' ? totalAmount : null,
          subtotal: totalAmount,
          discountAmount: 0,
          discountNote: null,
          excusedSessions: 0,
          totalAmount,
          dueDate: addDays(now, 7 + index * 7),
          status: 'unpaid',
          paymentMethod: null,
          paidAt: null,
          paidAmount: 0,
          confirmedBy: null,
          paymentIds: [],
          vnpayTransactionRef: null,
          vnpayTransactionId: null,
          generationType: 'manual',
          note: 'Phiếu test thanh toán VNPay sandbox',
          createdBy: null,
          deletedAt: null,
        },
      };
    });

    const invoiceCodes = testInvoices.map(item => item.invoiceCode);
    const existingInvoices = await Invoice.find({
      invoiceCode: { $in: invoiceCodes },
    })
      .select('_id')
      .lean();

    if (existingInvoices.length) {
      await Payment.deleteMany({
        invoiceId: { $in: existingInvoices.map(invoice => invoice._id) },
      });
    }

    for (const item of testInvoices) {
      await Invoice.findOneAndUpdate(
        { invoiceCode: item.invoiceCode },
        {
          $set: item.data,
          $setOnInsert: { _id: new Types.ObjectId() },
        },
        { upsert: true, returnDocument: 'after', runValidators: true }
      );
    }

    console.log(`Đã tạo ${testInvoices.length} phiếu chưa thanh toán cho ${student.fullName}:`);
    for (const item of testInvoices) {
      console.log(`- ${item.invoiceCode}: ${item.data.totalAmount.toLocaleString('vi-VN')} đ`);
    }
    console.log(`Đăng nhập phụ huynh: ${parentEmail}`);
    console.log('Mở: /parent/invoices');
  } finally {
    await mongoose.disconnect();
  }
};

seedVnpayInvoices().catch(error => {
  console.error('Không thể tạo phiếu test VNPay:', error);
  process.exitCode = 1;
});
