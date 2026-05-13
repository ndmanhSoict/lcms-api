import { sendCreated, sendPaginated, sendSuccess } from '../../shared/utils/response.helper.js';
import { BranchService } from './branch.service.js';
import { getPaginationMeta } from '../../shared/constants/pagination.helper.js';
export class BranchController {
    constructor() {
        this.createBranch = async (req, res, next) => {
            try {
                const branch = await this.branchService.createBranch(req.body);
                sendCreated(res, branch, 'Tạo chi nhánh mới thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.getBranches = async (req, res, next) => {
            try {
                // Truyền cả query và user để thực hiện phân quyền và lọc
                const result = await this.branchService.getBranches(req.query, req.user);
                const meta = getPaginationMeta(result.totalItems, result.page, result.limit);
                sendPaginated(res, result.branches, meta, 'Lấy danh sách chi nhánh thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.getBranchById = async (req, res, next) => {
            try {
                const branch = await this.branchService.getBranchById(req.params.id, req.user);
                // Sử dụng sendSuccess để chuẩn hóa response
                sendSuccess(res, branch, 'Lấy thông tin chi nhánh thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.getBranchOverview = async (req, res, next) => {
            try {
                const overview = await this.branchService.getBranchOverview(req.params.id, req.user);
                sendSuccess(res, overview, 'Lấy tổng quan chi nhánh thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.getMyBranchOverview = async (req, res, next) => {
            try {
                const overview = await this.branchService.getMyBranchOverview(req.user);
                sendSuccess(res, overview, 'Lấy tổng quan cơ sở hiện tại thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.updateBranch = async (req, res, next) => {
            try {
                const branch = await this.branchService.updateBranch(req.params.id, req.body, req.user);
                sendSuccess(res, branch, 'Cập nhật thông tin chi nhánh thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.toggleActive = async (req, res, next) => {
            try {
                const branch = await this.branchService.toggleActive(req.params.id);
                sendSuccess(res, { isActive: branch.isActive }, 'Thay đổi trạng thái hoạt động thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.branchService = new BranchService();
    }
}
//# sourceMappingURL=branch.controller.js.map