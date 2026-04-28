import { Request, Response, NextFunction } from 'express';
import { FinanceService } from './finance.service.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.helper.js';

export class FinanceController {
  private service: FinanceService;

  constructor() {
    this.service = new FinanceService();
  }

  // 12.1 Tạo phiếu học phí thủ công
  createInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.createInvoice(req.body, req.user);
      sendCreated(res, result, 'Tạo phiếu học phí thành công');
    } catch (error) { next(error); }
  };

  // 12.2 Batch generate
  batchGenerateInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.batchGenerateInvoices(req.body, req.user);
      sendSuccess(res, result, result.message);
    } catch (error) { next(error); }
  };

  // 12.3 Lấy danh sách phiếu học phí
  getInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, meta } = await this.service.getInvoices(req.query, req.user);
      sendSuccess(res, data, 'Lấy danh sách phiếu học phí thành công', 200, meta as unknown as Record<string, unknown>);
    } catch (error) { next(error); }
  };

  // 12.4 Chi tiết phiếu học phí
  getInvoiceById = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getInvoiceById(req.params.id, req.user);
      sendSuccess(res, result, 'Lấy chi tiết phiếu học phí thành công');
    } catch (error) { next(error); }
  };

  // 12.5 Thu tiền mặt
  payCash = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.payCash(req.params.id, req.body, req.user);
      sendSuccess(res, result, 'Xác nhận thu tiền thành công');
    } catch (error) { next(error); }
  };

  // 12.6 Tạo link VNPay
  vnpayCreatePayment = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.vnpayCreatePayment(req.params.id, req.body, req.user);
      sendSuccess(res, result, 'Tạo link thanh toán thành công');
    } catch (error) { next(error); }
  };

  // 12.7 VNPay Webhook (IPN) — không dùng sendSuccess (VNPay cần format riêng)
  vnpayWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.vnpayWebhook({ ...req.body, ...req.query });
      res.status(200).json(result);
    } catch (error) { next(error); }
  };

  // 12.8 VNPay Return — redirect FE
  vnpayReturn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, invoice_code } = await this.service.vnpayReturn(req.query);
      const baseUrl = (req.query.vnp_ReturnUrl as string) || 'https://app.lcms.vn/payment/result';
      const url = new URL(baseUrl);
      url.searchParams.set('status', status);
      url.searchParams.set('invoice_code', invoice_code ?? '');
      res.redirect(url.toString());
    } catch (error) { next(error); }
  };
}
