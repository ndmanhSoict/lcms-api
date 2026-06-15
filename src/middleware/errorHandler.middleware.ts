import { Request, Response, NextFunction } from 'express';
import { HttpStatus } from '../shared/constants/httpStatus.js';
import { ApiErrorResponse } from '../types/response.types.js';
import logger from '../shared/constants/logger.js';

type ErrorLike = {
  name?: string;
  message?: string;
  statusCode?: number;
  code?: string | number;
  details?: unknown;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
  value?: unknown;
  path?: string;
};

function normalizeError(error: unknown): ErrorLike {
  return error instanceof Error ? error : {};
}

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const error = normalizeError(err);
  let statusCode = error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
  let message = error.message || 'Đã có lỗi xảy ra từ phía server';
  let code = String(error.code || 'INTERNAL_ERROR');
  const details = error.details || undefined;

  // Xử lý lỗi từ Mongoose (ví dụ: CastError khi sai ID)
  if (error.name === 'CastError') {
    statusCode = HttpStatus.BAD_REQUEST;
    message = `Giá trị '${String(error.value)}' không hợp lệ cho trường '${error.path ?? ''}'`;
    code = 'INVALID_ID';
  }

  // Xử lý lỗi trùng lặp dữ liệu MongoDB (Duplicate Key)
  if (error.code === 11000) {
    const duplicateFields = Object.keys(error.keyPattern ?? error.keyValue ?? {});
    const duplicateField = duplicateFields[0];
    const fieldMessages: Record<string, string> = {
      email: 'Email này đã được sử dụng',
      phone: 'Số điện thoại này đã được sử dụng',
      userCode: 'Mã người dùng này đã tồn tại',
      branchCode: 'Mã cơ sở này đã tồn tại',
    };

    statusCode = HttpStatus.CONFLICT;
    message = duplicateField
      ? (fieldMessages[duplicateField] ?? `Trường ${duplicateField} đã tồn tại trong hệ thống`)
      : 'Dữ liệu đã tồn tại trong hệ thống';
    code = 'DUPLICATE_KEY';
  }

  const response: ApiErrorResponse = {
    success: false,
    message,
    code,
    ...(details && { details }),
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  };

  logger.error(
    `[${req.method}] ${req.path} - RequestID: ${req.requestId} - Code: ${code} - Message: ${message}`
  );

  res.status(statusCode).json(response);
};
