import { Types } from 'mongoose';
import { User } from '../../models/user.model.js';
import { Class } from '../../models/class.model.js';
import { Invoice } from '../../models/invoice.model.js';
import { Attendance } from '../../models/attendance.model.js';
import { ClassSession } from '../../models/classSession.model.js';
import { Branch } from '../../models/branch.model.js';

export class ReportRepository {
  // ── Helpers thời gian ─────────────────────────────────────────
  private startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
  private startOfWeek(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  private endOfWeek(date: Date) {
    const start = this.startOfWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  // ── 15.1 Branch Dashboard ─────────────────────────────────────
  async getStudentStats(branchId: string) {
    const branchFilter = { branchId: new Types.ObjectId(branchId), role: 'student', deletedAt: null };
    const now = new Date();
    const monthStart = this.startOfMonth(now);

    const [totalActive, newThisMonth, noClass] = await Promise.all([
      User.countDocuments({ ...branchFilter, isActive: true }),
      User.countDocuments({ ...branchFilter, isActive: true, createdAt: { $gte: monthStart } }),
      User.countDocuments({
        ...branchFilter,
        isActive: true,
        'studentInfo.activeClassIds': { $size: 0 },
      }),
    ]);
    return { total_active: totalActive, new_this_month: newThisMonth, no_class: noClass };
  }

  async getClassStats(branchId: string) {
    const branchObjectId = new Types.ObjectId(branchId);
    const [totalActive, enrolledAgg] = await Promise.all([
      Class.countDocuments({ branchId: branchObjectId, status: 'active', deletedAt: null }),
      Class.aggregate([
        { $match: { branchId: branchObjectId, status: 'active', deletedAt: null } },
        { $group: { _id: null, totalEnrolled: { $sum: '$studentCount' } } },
      ]),
    ]);
    return {
      total_active: totalActive,
      total_students_enrolled: enrolledAgg[0]?.totalEnrolled ?? 0,
    };
  }

  async getFinanceStats(branchId: string) {
    const branchObjectId = new Types.ObjectId(branchId);
    const now = new Date();
    const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

    const [revThis, revLast, unpaid, overdue] = await Promise.all([
      Invoice.aggregate([
        { $match: { branchId: branchObjectId, status: 'paid', billingPeriod: thisMonthStr } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Invoice.aggregate([
        { $match: { branchId: branchObjectId, status: 'paid', billingPeriod: lastMonthStr } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Invoice.aggregate([
        { $match: { branchId: branchObjectId, status: 'unpaid' } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
      ]),
      Invoice.countDocuments({ branchId: branchObjectId, status: 'overdue' }),
    ]);

    return {
      revenue_this_month: revThis[0]?.total ?? 0,
      revenue_last_month: revLast[0]?.total ?? 0,
      unpaid_invoices: unpaid[0]?.count ?? 0,
      unpaid_amount: unpaid[0]?.amount ?? 0,
      overdue_invoices: overdue,
    };
  }

  async getAttendanceStats(branchId: string) {
    const branchObjectId = new Types.ObjectId(branchId);
    const now = new Date();
    const weekStart = this.startOfWeek(now);
    const weekEnd = this.endOfWeek(now);

    const [weekSessions, attendanceAgg] = await Promise.all([
      ClassSession.countDocuments({
        branchId: branchObjectId,
        sessionDate: { $gte: weekStart, $lte: weekEnd },
        status: { $ne: 'cancelled' },
      }),
      Attendance.aggregate([
        {
          $match: {
            branchId: branchObjectId,
            sessionDate: { $gte: weekStart, $lte: weekEnd },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const agg = attendanceAgg[0];
    const avgRate = agg && agg.total > 0
      ? Math.round((agg.present / agg.total) * 1000) / 10
      : 0;

    return { this_week_sessions: weekSessions, avg_attendance_rate: avgRate };
  }

  // ── 15.2 Revenue ──────────────────────────────────────────────
  async getRevenueReport(branchFilter: Record<string, any>, year: number, fromMonth: number, toMonth: number) {
    const periods: string[] = [];
    for (let m = fromMonth; m <= toMonth; m++) {
      periods.push(`${year}-${String(m).padStart(2, '0')}`);
    }

    const [summary, monthly, bySubject] = await Promise.all([
      Invoice.aggregate([
        { $match: { ...branchFilter, billingPeriod: { $in: periods } } },
        {
          $group: {
            _id: null,
            total_revenue: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$totalAmount', 0] } },
            total_invoices: { $sum: 1 },
            paid_invoices: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
            unpaid_invoices: { $sum: { $cond: [{ $ne: ['$status', 'paid'] }, 1, 0] } },
          },
        },
      ]),
      Invoice.aggregate([
        { $match: { ...branchFilter, billingPeriod: { $in: periods } } },
        {
          $group: {
            _id: '$billingPeriod',
            revenue: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$totalAmount', 0] } },
            invoice_count: { $sum: 1 },
            paid_count: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
            unpaid_count: { $sum: { $cond: [{ $ne: ['$status', 'paid'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { period: '$_id', revenue: 1, invoice_count: 1, paid_count: 1, unpaid_count: 1, _id: 0 } },
      ]),
      Invoice.aggregate([
        { $match: { ...branchFilter, status: 'paid', billingPeriod: { $in: periods } } },
        {
          $group: {
            _id: '$classSnapshot.subjectName',
            revenue: { $sum: '$totalAmount' },
          },
        },
        { $project: { subject_name: '$_id', revenue: 1, _id: 0 } },
        { $sort: { revenue: -1 } },
      ]),
    ]);

    return {
      summary: summary[0] ?? { total_revenue: 0, total_invoices: 0, paid_invoices: 0, unpaid_invoices: 0 },
      monthly,
      by_subject: bySubject,
    };
  }

  // ── 15.3 At-risk students ─────────────────────────────────────
  async getAtRiskStudents(branchId: string, consecutiveThreshold: number) {
    const branchObjectId = new Types.ObjectId(branchId);

    // Lấy attendance trong 60 ngày gần nhất của branch, sắp xếp theo học sinh + lớp + ngày
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);

    const records = await Attendance.find({
      branchId: branchObjectId,
      sessionDate: { $gte: cutoff },
    })
      .sort({ studentId: 1, classId: 1, sessionDate: -1 })
      .select('studentId classId status sessionDate')
      .lean();

    // Group by (studentId, classId)
    const groups = new Map<string, typeof records>();
    for (const r of records) {
      const key = `${r.studentId}_${r.classId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    // Tìm các cặp có chuỗi vắng liên tiếp >= threshold
    const atRisk: {
      studentId: string;
      classId: string;
      consecutiveAbsences: number;
      lastPresent: Date | null;
    }[] = [];

    for (const [, recs] of groups) {
      let count = 0;
      let lastPresent: Date | null = null;
      for (const r of recs) { // sorted DESC
        if (r.status === 'absent') {
          count++;
        } else {
          lastPresent = r.sessionDate;
          break;
        }
      }
      if (count >= consecutiveThreshold) {
        atRisk.push({
          studentId: recs[0].studentId.toString(),
          classId: recs[0].classId.toString(),
          consecutiveAbsences: count,
          lastPresent,
        });
      }
    }

    if (atRisk.length === 0) return [];

    // Populate student + class info
    const studentIds = [...new Set(atRisk.map(r => r.studentId))];
    const classIds = [...new Set(atRisk.map(r => r.classId))];

    const [students, classes] = await Promise.all([
      User.find({ _id: { $in: studentIds } })
        .select('fullName userCode parentIds studentInfo')
        .lean(),
      Class.find({ _id: { $in: classIds } }).select('name').lean(),
    ]);

    const studentMap = new Map(students.map(s => [s._id.toString(), s]));
    const classMap = new Map(classes.map(c => [c._id.toString(), c]));

    // Lấy SĐT phụ huynh
    const parentIds = students.flatMap(s => s.studentInfo?.parentIds?.map(String) ?? []);
    const parents = await User.find({ _id: { $in: parentIds } }).select('phone').lean();
    const parentMap = new Map(parents.map(p => [p._id.toString(), p.phone]));

    return atRisk.map(r => {
      const student = studentMap.get(r.studentId);
      const cls = classMap.get(r.classId);
      const parentPhone = (student?.studentInfo?.parentIds ?? [])
        .map((id: Types.ObjectId) => parentMap.get(id.toString()))
        .find(Boolean) ?? null;

      return {
        student: {
          _id: r.studentId,
          full_name: student?.fullName ?? null,
          user_code: student?.userCode ?? null,
        },
        class: { name: cls?.name ?? null },
        consecutive_absences: r.consecutiveAbsences,
        last_present: r.lastPresent,
        parent_phone: parentPhone ?? null,
      };
    });
  }

  // ── 15.4 System Dashboard ─────────────────────────────────────
  async getAllBranches() {
    return await Branch.find({ deletedAt: null, isActive: true }).lean();
  }

  async getBranchSummary(branchId: string) {
    const branchObjectId = new Types.ObjectId(branchId);
    const now = new Date();
    const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [studentsActive, revenueAgg, unpaidAgg] = await Promise.all([
      User.countDocuments({ branchId: branchObjectId, role: 'student', isActive: true, deletedAt: null }),
      Invoice.aggregate([
        { $match: { branchId: branchObjectId, status: 'paid', billingPeriod: thisMonthStr } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Invoice.aggregate([
        { $match: { branchId: branchObjectId, status: { $in: ['unpaid', 'overdue'] } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } },
      ]),
    ]);

    return {
      students_active: studentsActive,
      revenue_this_month: revenueAgg[0]?.total ?? 0,
      unpaid_count: unpaidAgg[0]?.count ?? 0,
      unpaid_amount: unpaidAgg[0]?.amount ?? 0,
    };
  }
}
