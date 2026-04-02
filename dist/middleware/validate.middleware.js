import { ZodError } from 'zod';
import { ValidationError } from '../shared/errors/AllErrors.js';
export const validate = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                const errorMessages = error.issues
                    .map(issue => {
                    const path = issue.path.join('.');
                    const field = path.replace(/^body\./, '');
                    return `${field}: ${issue.message}`;
                })
                    .join(', ');
                next(new ValidationError(`Dữ liệu không hợp lệ: ${errorMessages}`, error.issues));
            }
            else {
                next(error);
            }
        }
    };
};
//# sourceMappingURL=validate.middleware.js.map