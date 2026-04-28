import { Types } from 'mongoose';
import { ReportRepository } from './report.repository.js';
import { ROLES } from '../../shared/constants/roles.js';
import { ForbiddenError, BadRequestError } from '../../shared/errors/AllErrors.js';

export class ReportService {
  private repo: ReportRepository;

  constructor() {
    this.repo = new ReportRepository();
  }

  private resolveBranchId(query: any, requester: any): string {
    if (requester.role === ROLES.SYSTEM_OWNER) {
      if (!query.branch_id) throw new BadRequestError('System Owner cần truyền branch_id');
      return query.branch_id;
    }
    return requester.branchId;
  }

  // 15.1 Dashboard tổng hợp theo cơ sở
  async getBranchDashboard(query: any, requester: any) {
    const branchId = this.resolveBranchId(query, requester);

    const [students, classes, finance, attendance] = await Promise.all([
      this.repo.getStudentStats(branchId),
      this.repo.getClassStats(branchId),
      this.repo.getFinanceStats(branchId),
      this.repo.getAttendanceStats(branchId),
    ]);

    return {
      branch_id: branchId,
      as_of: new Date().toISOString(),
      students,
      classes,
      finance,
      attendance,
    };
  }

  // 15.2 Báo cáo doanh thu
  async getRevenueReport(query: any, requester: any) {
    const year = parseInt(query.year) || new Date().getFullYear();
    const fromMonth = parseInt(query.from_month) || 1;
    const toMonth = parseInt(query.to_month) || 12;

    if (fromMonth < 1 || toMonth > 12 || fromMonth > toMonth) {
      throw new BadRequestError('Khoảng tháng không hợp lệ (1–12, from_month <= to_month)');
    }

    const branchFilter: Record<string, any> = {};
    if (requester.role === ROLES.SYSTEM_OWNER) {
      if (query.branch_id) branchFilter.branchId = new Types.ObjectId(query.branch_id);
    } else {
      branchFilter.branchId = new Types.ObjectId(requester.branchId);
    }

    return await this.repo.getRevenueReport(branchFilter, year, fromMonth, toMonth);
  }

  // 15.3 Học sinh có nguy cơ bỏ học
  async getAtRiskStudents(query: any, requester: any) {
    const branchId = this.resolveBranchId(query, requester);
    const threshold = parseInt(query.consecutive_absences) || 3;
    if (threshold < 1) throw new BadRequestError('consecutive_absences phải >= 1');

    return await this.repo.getAtRiskStudents(branchId, threshold);
  }

  // 15.4 Dashboard toàn hệ thống
  async getSystemDashboard(requester: any) {
    if (requester.role !== ROLES.SYSTEM_OWNER) {
      throw new ForbiddenError('Chỉ System Owner mới có quyền xem dashboard hệ thống');
    }

    const branches = await this.repo.getAllBranches();
    const summaries = await Promise.all(
      branches.map(async b => {
        const stats = await this.repo.getBranchSummary(b._id.toString());
        return {
          branch_id: b._id,
          branch_name: b.name,
          students_active: stats.students_active,
          revenue_this_month: stats.revenue_this_month,
        };
      })
    );

    const totalStudents = summaries.reduce((s, b) => s + b.students_active, 0);
    const totalRevenue = summaries.reduce((s, b) => s + b.revenue_this_month, 0);

    // Tổng unpaid toàn hệ thống
    const allUnpaid = await Promise.all(
      branches.map(b => this.repo.getBranchSummary(b._id.toString()))
    );
    const totalUnpaid = allUnpaid.reduce((s, b) => s + b.unpaid_count, 0);
    const totalUnpaidAmount = allUnpaid.reduce((s, b) => s + b.unpaid_amount, 0);

    return {
      branches: summaries,
      total_students: totalStudents,
      total_revenue_this_month: totalRevenue,
      total_unpaid: totalUnpaid,
      total_unpaid_amount: totalUnpaidAmount,
    };
  }
}
