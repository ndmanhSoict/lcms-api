import { Router } from 'express';
import { authenticate } from '../../middleware/auth/authenticate.middleware.js';
import { authorize } from '../../middleware/auth/authorize.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';
import { FinanceController } from './finance.controller.js';
import {
  createInvoiceSchema,
  calculateInvoiceSchema,
  batchGenerateInvoiceSchema,
  deleteInvoiceSchema,
  vnpayCreateBulkPaymentSchema,
  payCashSchema,
  vnpayCreatePaymentSchema,
} from './finance.schema.js';

export const financeRouter = Router();
const controller = new FinanceController();

// ── Routes KHÔNG cần JWT (VNPay server gọi) ──────────────────

// 12.7 VNPay IPN Webhook — trước /:id để không bị match nhầm
financeRouter.get('/invoices/vnpay/webhook', controller.vnpayWebhook);
financeRouter.post('/invoices/vnpay/webhook', controller.vnpayWebhook);

// 12.8 VNPay Return
financeRouter.get('/invoices/vnpay/return', controller.vnpayReturn);

// ── Routes cần JWT ────────────────────────────────────────────
financeRouter.use(authenticate);

// 12.1 Tạo phiếu thủ công — SO/BO/ST
financeRouter.post(
  '/invoices',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF),
  validate(createInvoiceSchema),
  controller.createInvoice
);

// 12.1b Tính thử học phí — SO/BO/ST (trước /:id)
financeRouter.post(
  '/invoices/calculate',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF),
  validate(calculateInvoiceSchema),
  controller.calculateInvoice
);

// 12.2 Batch generate — SO/BO (trước /:id)
financeRouter.post(
  '/invoices/batch-generate',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF),
  validate(batchGenerateInvoiceSchema),
  controller.batchGenerateInvoices
);

// 12.3 Lấy danh sách (RBAC trong service)
financeRouter.get('/invoices', controller.getInvoices);

// 12.4b Lịch sử giao dịch (RBAC trong service)
financeRouter.get('/payments', controller.getPayments);

// 12.4 Chi tiết phiếu (RBAC trong service)
financeRouter.get('/invoices/:id', controller.getInvoiceById);

financeRouter.delete(
  '/invoices/:id',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF),
  validate(deleteInvoiceSchema),
  controller.deleteInvoice
);

// 12.5 Thu tiền mặt — SO/BO/ST
financeRouter.post(
  '/invoices/:id/pay-cash',
  authorize(ROLES.SYSTEM_OWNER, ROLES.BRANCH_OWNER, ROLES.STAFF),
  validate(payCashSchema),
  controller.payCash
);

// 12.6 Tạo link VNPay (RBAC trong service)
financeRouter.post(
  '/invoices/vnpay/create-bulk-payment',
  validate(vnpayCreateBulkPaymentSchema),
  controller.vnpayCreateBulkPayment
);

financeRouter.post(
  '/invoices/:id/vnpay/create-payment',
  validate(vnpayCreatePaymentSchema),
  controller.vnpayCreatePayment
);
