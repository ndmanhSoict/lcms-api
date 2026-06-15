import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.validation.js';
import { IUser } from '../../models/user.model.js';

export const generateTokens = (user: IUser) => {
  const accessTokenPayload = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    ...(user.branchId && { branchId: user.branchId.toString() }),
  };

  const accessToken = jwt.sign(accessTokenPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as SignOptions['expiresIn'],
  });

  const refreshToken = jwt.sign({ id: user._id.toString() }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES as SignOptions['expiresIn'],
  });

  return { accessTokenPayload, accessToken, refreshToken };
};
