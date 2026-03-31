import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3003),
  MONGODB_URI: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15mins'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES: z.string().default('7days'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Biến môi trường không hợp lệ:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
