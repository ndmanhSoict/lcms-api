import { Types } from 'mongoose';
import { ReportRepository } from './report.repository.js';
import { ROLES } from '../../shared/constants/roles.js';
import { ForbiddenError, BadRequestError } from '../../shared/errors/AllErrors.js';

export class ReportService {
  private repo: ReportRepository;

  constructor() {
    this.repo = new ReportRepository();
  }

  private resolveBranchId(query: AppQuery, requester: RequestUser): string {
    if (requester.role === ROLES.SYSTEM_OWNER) {
      if (!query.branch_id) throw new BadRequestError('System Owner cần truyền branch_id');
      return query.branch_id;
    }
    if (!requester.branchId) throw new ForbiddenError('Tài khoản hiện tại chưa được gán cơ sở');
    return requester.branchId;
  }

  // 15.1 Dashboard tổng hợp theo cơ sở
  async getBranchDashboard(query: AppQuery, requester: RequestUser) {
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
  async getRevenueReport(query: AppQuery, requester: RequestUser) {
    const year = parseInt(String(query.year ?? ''), 10) || new Date().getFullYear();
    const fromMonth = parseInt(String(query.from_month ?? ''), 10) || 1;
    const toMonth = parseInt(String(query.to_month ?? ''), 10) || 12;

    if (fromMonth < 1 || toMonth > 12 || fromMonth > toMonth) {
      throw new BadRequestError('Khoảng tháng không hợp lệ (1–12, from_month <= to_month)');
    }

    const branchFilter: Record<string, unknown> = {};
    if (requester.role === ROLES.SYSTEM_OWNER) {
      if (query.branch_id) branchFilter.branchId = new Types.ObjectId(query.branch_id);
    } else {
      if (!requester.branchId) throw new ForbiddenError('Tài khoản hiện tại chưa được gán cơ sở');
      branchFilter.branchId = new Types.ObjectId(requester.branchId);
    }

    return await this.repo.getRevenueReport(branchFilter, year, fromMonth, toMonth);
  }

  // 15.3 Học sinh có nguy cơ bỏ học
  async getAtRiskStudents(query: AppQuery, requester: RequestUser) {
    const branchId = this.resolveBranchId(query, requester);
    const threshold = parseInt(String(query.consecutive_absences ?? ''), 10) || 3;
    if (threshold < 1) throw new BadRequestError('consecutive_absences phải >= 1');

    return await this.repo.getAtRiskStudents(branchId, threshold);
  }

  // 15.4 Dashboard toàn hệ thống
  async getSystemDashboard(requester: RequestUser) {
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
          contact_email: b.email,
          is_active: b.isActive,
          students_active: stats.students_active,
          parents_active: stats.parents_active,
          teachers_active: stats.teachers_active,
        };
      })
    );

    const totalStudents = summaries.reduce((s, b) => s + b.students_active, 0);
    const totalParents = summaries.reduce((s, b) => s + b.parents_active, 0);
    const totalTeachers = summaries.reduce((s, b) => s + b.teachers_active, 0);
    const totalActiveBranches = summaries.filter(b => b.is_active).length;
    const totalPausedBranches = summaries.length - totalActiveBranches;

    return {
      branches: summaries,
      total_students: totalStudents,
      total_parents: totalParents,
      total_teachers: totalTeachers,
      total_active_branches: totalActiveBranches,
      total_paused_branches: totalPausedBranches,
    };
  }

  async getBranchAnalytics(query: AppQuery, requester: RequestUser) {
    if (requester.role !== ROLES.BRANCH_OWNER || !requester.branchId) {
      throw new ForbiddenError('Chỉ Chủ cơ sở mới có quyền xem báo cáo này');
    }

    const mode = query.mode === 'year' ? 'year' : 'month';
    const year = Number(query.year);
    const month = mode === 'month' ? Number(query.month) : undefined;
    const start =
      mode === 'month'
        ? new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000+07:00`)
        : new Date(`${year}-01-01T00:00:00.000+07:00`);
    const end =
      mode === 'month'
        ? new Date(
            `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month! + 1).padStart(
              2,
              '0'
            )}-01T00:00:00.000+07:00`
          )
        : new Date(`${year + 1}-01-01T00:00:00.000+07:00`);

    const raw = await this.repo.getBranchAnalytics({
      branchId: requester.branchId,
      mode,
      year,
      month,
      start,
      end,
    });

    const trendMap = new Map(raw.trends.map(item => [item.key, item]));
    const timeline =
      mode === 'year'
        ? Array.from({ length: 12 }, (_, index) => {
            const key = `${year}-${String(index + 1).padStart(2, '0')}`;
            return { key, label: `Tháng ${index + 1}` };
          })
        : Array.from({ length: new Date(year, month!, 0).getDate() }, (_, index) => {
            const day = index + 1;
            const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            return { key, label: String(day) };
          });

    const trends = timeline.map(point => ({
      ...point,
      revenue: 0,
      invoiced: 0,
      present: 0,
      absent: 0,
      attendance_rate: 0,
      new_students: 0,
      left_students: 0,
      sessions: 0,
      ...trendMap.get(point.key),
      label: point.label,
    }));

    return {
      branch_id: requester.branchId,
      generated_at: new Date().toISOString(),
      period: {
        mode,
        year,
        month: month ?? null,
        start: start.toISOString(),
        end: end.toISOString(),
        label: mode === 'year' ? `Năm ${year}` : `Tháng ${month}/${year}`,
      },
      ...raw,
      trends,
    };
  }
}
