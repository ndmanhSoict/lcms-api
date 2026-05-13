import { sendSuccess } from '../../shared/utils/response.helper.js';
import { AuthService } from './auth.service.js';
export class AuthController {
    constructor() {
        this.login = async (req, res, next) => {
            try {
                const result = await this.authService.login(req.body, req.ip, req.headers['user-agent']);
                sendSuccess(res, result, 'Đăng nhập thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.refreshToken = async (req, res, next) => {
            try {
                const result = await this.authService.refreshToken(req.body.refreshToken);
                sendSuccess(res, result, 'Làm mới token thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.logout = async (req, res, next) => {
            try {
                // Sửa: Truyền toàn bộ req.user thay vì chỉ lấy req.user.id
                await this.authService.logout(req.body.refreshToken, req.user);
                sendSuccess(res, null, 'Đăng xuất thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.changePassword = async (req, res, next) => {
            try {
                await this.authService.changePassword(req.user.id, req.body);
                sendSuccess(res, null, 'Đổi mật khẩu thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.resetPassword = async (req, res, next) => {
            try {
                const adminId = req.user.id;
                const adminRole = req.user.role;
                const adminBranchId = req.user.branchId;
                const targetUserId = req.params.userId;
                await this.authService.resetPassword(adminId, adminRole, adminBranchId, targetUserId, req.body.newPassword);
                sendSuccess(res, null, 'Reset mật khẩu thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.authService = new AuthService();
    }
}
//# sourceMappingURL=auth.controller.js.map