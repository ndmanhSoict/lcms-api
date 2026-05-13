import { HttpStatus } from '../constants/httpStatus.js';
import { AppError } from './AppError.js';
export class UnauthorizedError extends AppError {
    constructor(message = 'Chưa đăng nhập hoặc token không hợp lệ') {
        super(message, HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED');
    }
}
export class ForbiddenError extends AppError {
    constructor(message = 'Không có quyền thực hiện thao tác này') {
        super(message, HttpStatus.FORBIDDEN, 'FORBIDDEN');
    }
}
export class NotFoundError extends AppError {
    constructor(resource = 'Tài nguyên') {
        super(`${resource} không tồn tại`, HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
}
export class ValidationError extends AppError {
    constructor(message = 'Dữ liệu không hợp lệ', details) {
        super(message, HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', details);
    }
}
export class ConflictError extends AppError {
    constructor(message) {
        super(message, HttpStatus.CONFLICT, 'CONFLICT');
    }
}
export class BadRequestError extends AppError {
    constructor(message = 'Yêu cầu không hợp lệ') {
        super(message, HttpStatus.BAD_REQUEST, 'BAD_REQUEST');
    }
}
//# sourceMappingURL=AllErrors.js.map