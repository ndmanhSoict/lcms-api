import { sendCreated, sendPaginated } from '../../shared/utils/response.helper.js';
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
                const result = await this.branchService.getBranches(req.query);
                const meta = getPaginationMeta(result.totalItems, result.page, result.limit);
                sendPaginated(res, result.branches, meta, 'Lấy danh sách chi nhánh thành công');
            }
            catch (error) {
                next(error);
            }
        };
        this.branchService = new BranchService();
    }
}
//# sourceMappingURL=branch.controller.js.map