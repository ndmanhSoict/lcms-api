import { Request, Response, NextFunction } from 'express'
import { HttpStatus } from '../shared/constants/httpStatus.js'
import { ApiErrorResponse } from '../types/response.types.js'

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
  let message = err.message || 'Đã có lỗi xảy ra từ phía server'
  let code = err.code || 'INTERNAL_ERROR'
  let details = err.details || undefined

  // Xử lý lỗi từ Mongoose (ví dụ: CastError khi sai ID)
  if (err.name === 'CastError') {
    statusCode = HttpStatus.BAD_REQUEST
    message = `Giá trị '${err.value}' không hợp lệ cho trường '${err.path}'`
    code = 'INVALID_ID'
  }

  // Xử lý lỗi trùng lặp dữ liệu MongoDB (Duplicate Key)
  if (err.code === 11000) {
    statusCode = HttpStatus.CONFLICT
    message = 'Dữ liệu đã tồn tại trong hệ thống'
    code = 'DUPLICATE_KEY'
  }

  const response: ApiErrorResponse = {
    success: false,
    message,
    code,
    ...(details && { details }),
    requestId: req.requestId, // Đảm bảo bạn đã dùng middleware requestId trước đó
    timestamp: new Date().toISOString()
  }

  // Log lỗi để Tech Lead/Dev check (có thể dùng Winston thay vì console)
  console.error(`[Error] ${req.method} ${req.path} - RequestID: ${req.requestId} - Message: ${message}`)

  res.status(statusCode).json(response)
}