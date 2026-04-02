import { sendSuccess } from '../../shared/utils/response.helper.js';
import { AuthService } from './auth.service.js';
export class AuthController {
    constructor() {
        this.login = async (req, res, next) => {
            try {
                // Dữ liệu đã được kiểm tra qua validate.middleware
                const result = await this.authService.login(req.body);
                sendSuccess(res, {
                    user: result.user,
                    accessToken: result.tokens.accessToken,
                    refreshToken: result.tokens.refreshToken,
                }, 'Đăng nhập thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.refreshToken = async (req, res, next) => {
            try {
                const token = req.body.refreshToken;
                const result = await this.authService.refreshToken(token);
                sendSuccess(res, {
                    accessToken: result.tokens.accessToken,
                    refreshToken: result.tokens.refreshToken,
                }, 'Làm mới token thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.logout = async (req, res, next) => {
            try {
                sendSuccess(res, null, 'Đăng xuất thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.authService = new AuthService();
    }
}
//# sourceMappingURL=auth.controller.js.map