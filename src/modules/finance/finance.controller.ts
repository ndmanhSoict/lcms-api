import { Request, Response, NextFunction } from 'express';
import type { ParsedQs } from 'qs';
import { FinanceService } from './finance.service.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.helper.js';
import type { VnpayParams } from '../../shared/utils/vnpay.helper.js';

export class FinanceController {
  private service: FinanceService;

  constructor() {
    this.service = new FinanceService();
  }

  private toVnpayParams(input: ParsedQs): VnpayParams {
    const params: VnpayParams = {};
    for (const [key, value] of Object.entries(input)) {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        value === null ||
        value === undefined
      ) {
        params[key] = value;
      } else if (Array.isArray(value)) {
        const first = value.find((item): item is string => typeof item === 'string');
        if (first !== undefined) params[key] = first;
      }
    }
    return params;
  }

  // 12.1 Tạo phiếu học phí thủ công
  createInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.createInvoice(req.body, req.user);
      sendCreated(res, result, 'Tạo phiếu học phí thành công');
    } catch (error) {
      next(error);
    }
  };

  // 12.1b Tính thử học phí
  calculateInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.calculateInvoice(req.body, req.user);
      sendSuccess(res, result, 'Tính học phí thành công');
    } catch (error) {
      next(error);
    }
  };

  // 12.2 Batch generate
  batchGenerateInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.batchGenerateInvoices(req.body, req.user);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  };

  // 12.3 Lấy danh sách phiếu học phí
  getInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, meta } = await this.service.getInvoices(req.query, req.user);
      sendSuccess(res, data, 'Lấy danh sách phiếu học phí thành công', 200, meta);
    } catch (error) {
      next(error);
    }
  };

  // 12.4 Chi tiết phiếu học phí
  getInvoiceById = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getInvoiceById(req.params.id, req.user);
      sendSuccess(res, result, 'Lấy chi tiết phiếu học phí thành công');
    } catch (error) {
      next(error);
    }
  };

  deleteInvoice = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.deleteInvoice(req.params.id, req.user);
      sendSuccess(res, result, 'Đã xóa phiếu học phí');
    } catch (error) {
      next(error);
    }
  };

  // 12.4b Lịch sử giao dịch
  getPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, meta } = await this.service.getPayments(req.query, req.user);
      sendSuccess(res, data, 'Lấy lịch sử giao dịch thành công', 200, meta);
    } catch (error) {
      next(error);
    }
  };

  // 12.5 Thu tiền mặt
  payCash = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.payCash(req.params.id, req.body, req.user);
      sendSuccess(res, result, 'Xác nhận thu tiền thành công');
    } catch (error) {
      next(error);
    }
  };

  // 12.6 Tạo link VNPay
  vnpayCreatePayment = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const body = { ...req.body, ip_addr: req.ip };

      console.log('[BE][VNPay][create-payment request]', {
        params: req.params,
        query: req.query,
        body,
      });

      const result = await this.service.vnpayCreatePayment(req.params.id, body, req.user);
      sendSuccess(res, result, 'Tạo link thanh toán thành công');
    } catch (error) {
      next(error);
    }
  };

  vnpayCreateBulkPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = { ...req.body, ip_addr: req.ip };
      const result = await this.service.vnpayCreateBulkPayment(body, req.user);
      sendSuccess(res, result, 'Tạo link thanh toán toàn bộ thành công');
    } catch (error) {
      next(error);
    }
  };

  // 12.7 VNPay Webhook (IPN) — không dùng sendSuccess (VNPay cần format riêng)
  vnpayWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('[BE][VNPay][webhook params]', {
        query: req.query,
        body: req.body,
      });

      const result = await this.service.vnpayWebhook({ ...req.body, ...req.query });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // 12.8 VNPay Return — redirect FE
  vnpayReturn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('[BE][VNPay][return query params]', req.query);

      const { status, invoice_code, redirect_url, message, response_code, transaction_status } =
        await this.service.vnpayReturn(this.toVnpayParams(req.query));
      const baseUrl = redirect_url;
      const url = new URL(baseUrl);
      url.searchParams.set('vnpay_status', status);
      url.searchParams.set('invoice_code', invoice_code ?? '');
      url.searchParams.set('message', message ?? '');
      if (response_code) url.searchParams.set('response_code', response_code);
      if (transaction_status) url.searchParams.set('transaction_status', transaction_status);
      res.redirect(url.toString());
    } catch (error) {
      next(error);
    }
  };
}
