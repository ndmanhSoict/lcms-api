import { HttpStatus } from '../constants/httpStatus.js';
export class AppError extends Error {
    constructor(message, statusCode = HttpStatus.INTERNAL_SERVER_ERROR, code = 'INTERNAL_ERROR', details) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
//# sourceMappingURL=AppError.js.map