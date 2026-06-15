import { ZodError } from 'zod';
import { ValidationError } from '../shared/errors/AllErrors.js';
export const validate = (schema) => {
    return async (req, res, next) => {
        try {
            const parsed = (await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            }));
            // Use Zod's parsed output so unknown request fields cannot bypass validation.
            if (parsed.body !== undefined)
                req.body = parsed.body;
            if (parsed.query !== undefined) {
                for (const key of Object.keys(req.query))
                    delete req.query[key];
                Object.assign(req.query, parsed.query);
            }
            if (parsed.params !== undefined) {
                for (const key of Object.keys(req.params))
                    delete req.params[key];
                Object.assign(req.params, parsed.params);
            }
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