import { env } from './env.validation.js';

export const databaseConfig = {
  mongodb: {
    uri: env.MONGODB_URI,
    options: {
      autoIndex: true,
    },
  },
};
