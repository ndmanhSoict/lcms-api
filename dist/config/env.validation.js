import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const optionalUrl = z.preprocess(value => (value === '' ? undefined : value), z.string().url().optional());
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).default(3003),
    APP_URL: z.string().url().default('http://localhost:3003'),
    FRONTEND_URL: z.string().url().default('http://localhost:5174'),
    MONGODB_URI: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES: z.string().default('15mins'),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_REFRESH_EXPIRES: z.string().default('7days'),
    VNPAY_TMN_CODE: z.string().default(''),
    VNPAY_HASH_SECRET: z.string().default(''),
    VNPAY_PAYMENT_URL: z.string().url().default('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
    VNPAY_RETURN_URL: optionalUrl,
    VNPAY_IPN_URL: optionalUrl,
    VNPAY_DEFAULT_BANK_CODE: z.string().default('NCB'),
});
const _env = envSchema.safeParse(process.env);
if (!_env.success) {
    console.error('❌ Biến môi trường không hợp lệ:', _env.error.format());
    process.exit(1);
}
export const env = _env.data;
//# sourceMappingURL=env.validation.js.map