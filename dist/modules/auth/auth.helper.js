import jwt from 'jsonwebtoken';
import { env } from '../../config/env.validation.js';
export const generateTokens = (user) => {
    const accessTokenPayload = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        ...(user.branchId && { branchId: user.branchId.toString() }),
    };
    const accessToken = jwt.sign(accessTokenPayload, env.JWT_ACCESS_SECRET, {
        expiresIn: env.JWT_ACCESS_EXPIRES,
    });
    const refreshToken = jwt.sign({ id: user._id.toString() }, env.JWT_REFRESH_SECRET, {
        expiresIn: env.JWT_REFRESH_EXPIRES,
    });
    return { accessTokenPayload, accessToken, refreshToken };
};
//# sourceMappingURL=auth.helper.js.map