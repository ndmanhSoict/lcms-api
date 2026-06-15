import { Types } from 'mongoose';
import { User } from '../../models/user.model.js';
import { Class } from '../../models/class.model.js';
import { Invoice } from '../../models/invoice.model.js';
import { Attendance } from '../../models/attendance.model.js';
import { ClassSession } from '../../models/classSession.model.js';
import { Branch } from '../../models/branch.model.js';
import { Enrollment } from '../../models/enrollment.model.js';
import { GradeRecord } from '../../models/gradeRecord.model.js';
import { Classroom } from '../../models/classroom.model.js';

type BranchAnalyticsParams = {
  branchId: string;
  mode: 'month' | 'year';
  year: number;
  month?: number;
  start: Date;
  end: Date;
};

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
    const branchFilter = {
      branchId: new Types.ObjectId(branchId),
      role: 'student',
      deletedAt: null,
    };
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
    const avgRate = agg && agg.total > 0 ? Math.round((agg.present / agg.total) * 1000) / 10 : 0;

    return { this_week_sessions: weekSessions, avg_attendance_rate: avgRate };
  }

  // ── 15.2 Revenue ──────────────────────────────────────────────
  async getRevenueReport(
    branchFilter: Record<string, unknown>,
    year: number,
    fromMonth: number,
    toMonth: number
  ) {
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
        {
          $project: {
            period: '$_id',
            revenue: 1,
            invoice_count: 1,
            paid_count: 1,
            unpaid_count: 1,
            _id: 0,
          },
        },
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
      summary: summary[0] ?? {
        total_revenue: 0,
        total_invoices: 0,
        paid_invoices: 0,
        unpaid_invoices: 0,
      },
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
      for (const r of recs) {
        // sorted DESC
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
      User.find({
        _id: { $in: studentIds },
        branchId: branchObjectId,
        role: 'student',
        deletedAt: null,
      })
        .select('fullName userCode parentIds studentInfo')
        .lean(),
      Class.find({ _id: { $in: classIds }, branchId: branchObjectId, deletedAt: null })
        .select('name')
        .lean(),
    ]);

    const studentMap = new Map(students.map(s => [s._id.toString(), s]));
    const classMap = new Map(classes.map(c => [c._id.toString(), c]));

    // Lấy SĐT phụ huynh
    const parentIds = students.flatMap(s => s.studentInfo?.parentIds?.map(String) ?? []);
    const parents = await User.find({
      _id: { $in: parentIds },
      branchId: branchObjectId,
      role: 'parent',
      deletedAt: null,
    })
      .select('phone')
      .lean();
    const parentMap = new Map(parents.map(p => [p._id.toString(), p.phone]));

    return atRisk.map(r => {
      const student = studentMap.get(r.studentId);
      const cls = classMap.get(r.classId);
      const parentPhone =
        (student?.studentInfo?.parentIds ?? [])
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
    return await Branch.find({ deletedAt: null })
      .select('_id name email isActive')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getBranchSummary(branchId: string) {
    const branchObjectId = new Types.ObjectId(branchId);
    const [studentsActive, parentsActive, teachersActive] = await Promise.all([
      User.countDocuments({
        branchId: branchObjectId,
        role: 'student',
        isActive: true,
        deletedAt: null,
      }),
      User.countDocuments({
        branchId: branchObjectId,
        role: 'parent',
        isActive: true,
        deletedAt: null,
      }),
      User.countDocuments({
        branchId: branchObjectId,
        role: 'teacher',
        isActive: true,
        deletedAt: null,
      }),
    ]);

    return {
      students_active: studentsActive,
      parents_active: parentsActive,
      teachers_active: teachersActive,
    };
  }

  async getBranchAnalytics(params: BranchAnalyticsParams) {
    const branchId = new Types.ObjectId(params.branchId);
    const dateFormat = params.mode === 'year' ? '%Y-%m' : '%Y-%m-%d';
    const dateRange = { $gte: params.start, $lt: params.end };
    const periodPrefix = String(params.year);
    const billingPeriodMatch =
      params.mode === 'year'
        ? { $regex: `^${periodPrefix}-` }
        : `${params.year}-${String(params.month).padStart(2, '0')}`;
    const timelineProject = {
      $dateToString: {
        format: dateFormat,
        date: '$timelineDate',
        timezone: 'Asia/Ho_Chi_Minh',
      },
    };

    const [
      peopleSummary,
      classSummary,
      financeSummary,
      attendanceSummary,
      scoreSummary,
      financeTrend,
      attendanceTrend,
      studentGrowthTrend,
      sessionTrend,
      invoiceStatus,
      classStatus,
      sessionStatus,
      subjectPerformance,
      topClasses,
      teacherWorkload,
      roomUsage,
      attendanceRisk,
    ] = await Promise.all([
      User.aggregate([
        { $match: { branchId, deletedAt: null } },
        {
          $group: {
            _id: null,
            active_students: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$role', 'student'] }, { $eq: ['$isActive', true] }] },
                  1,
                  0,
                ],
              },
            },
            active_teachers: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$role', 'teacher'] }, { $eq: ['$isActive', true] }] },
                  1,
                  0,
                ],
              },
            },
            active_parents: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$role', 'parent'] }, { $eq: ['$isActive', true] }] },
                  1,
                  0,
                ],
              },
            },
            new_students: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$role', 'student'] },
                      { $gte: ['$createdAt', params.start] },
                      { $lt: ['$createdAt', params.end] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Promise.all([
        Class.countDocuments({ branchId, status: 'active', deletedAt: null }),
        Class.countDocuments({ branchId, status: 'upcoming', deletedAt: null }),
        Classroom.countDocuments({ branchId, isActive: true, deletedAt: null }),
      ]),
      Invoice.aggregate([
        { $match: { branchId, deletedAt: null, billingPeriod: billingPeriodMatch } },
        {
          $group: {
            _id: null,
            invoiced_amount: { $sum: '$totalAmount' },
            revenue: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'paid'] },
                  { $ifNull: ['$paidAmount', '$totalAmount'] },
                  0,
                ],
              },
            },
            outstanding_amount: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['unpaid', 'overdue', 'partial']] },
                  {
                    $max: [0, { $subtract: ['$totalAmount', { $ifNull: ['$paidAmount', 0] }] }],
                  },
                  0,
                ],
              },
            },
            total_invoices: { $sum: 1 },
            paid_invoices: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
            overdue_invoices: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } },
          },
        },
      ]),
      Attendance.aggregate([
        { $match: { branchId, sessionDate: dateRange } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          },
        },
      ]),
      GradeRecord.aggregate([
        {
          $addFields: {
            timelineDate: { $ifNull: ['$publishedAt', '$updatedAt'] },
          },
        },
        {
          $match: {
            branchId,
            status: 'published',
            finalScore: { $ne: null },
            timelineDate: dateRange,
          },
        },
        {
          $group: {
            _id: null,
            average_score: { $avg: '$finalScore' },
            records: { $sum: 1 },
          },
        },
      ]),
      Invoice.aggregate([
        { $match: { branchId, deletedAt: null, billingPeriod: billingPeriodMatch } },
        {
          $addFields: {
            timelineDate: {
              $ifNull: [
                '$paidAt',
                {
                  $dateFromString: {
                    dateString: {
                      $concat: ['$billingPeriod', '-01T00:00:00.000+07:00'],
                    },
                  },
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: timelineProject,
            revenue: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'paid'] },
                  { $ifNull: ['$paidAmount', '$totalAmount'] },
                  0,
                ],
              },
            },
            invoiced: { $sum: '$totalAmount' },
          },
        },
      ]),
      Attendance.aggregate([
        { $match: { branchId, sessionDate: dateRange } },
        { $addFields: { timelineDate: '$sessionDate' } },
        {
          $group: {
            _id: timelineProject,
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          },
        },
      ]),
      Promise.all([
        User.aggregate([
          {
            $match: {
              branchId,
              role: 'student',
              deletedAt: null,
              createdAt: dateRange,
            },
          },
          { $addFields: { timelineDate: '$createdAt' } },
          { $group: { _id: timelineProject, count: { $sum: 1 } } },
        ]),
        Enrollment.aggregate([
          { $match: { branchId, leftAt: dateRange } },
          { $addFields: { timelineDate: '$leftAt' } },
          { $group: { _id: timelineProject, count: { $sum: 1 } } },
        ]),
      ]),
      ClassSession.aggregate([
        { $match: { branchId, sessionDate: dateRange, deletedAt: null } },
        { $addFields: { timelineDate: '$sessionDate' } },
        { $group: { _id: timelineProject, sessions: { $sum: 1 } } },
      ]),
      Invoice.aggregate([
        { $match: { branchId, deletedAt: null, billingPeriod: billingPeriodMatch } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$totalAmount' },
          },
        },
        { $sort: { count: -1 } },
      ]),
      Class.aggregate([
        { $match: { branchId, deletedAt: null } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      ClassSession.aggregate([
        { $match: { branchId, sessionDate: dateRange, deletedAt: null } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      GradeRecord.aggregate([
        { $addFields: { timelineDate: { $ifNull: ['$publishedAt', '$updatedAt'] } } },
        {
          $match: {
            branchId,
            status: 'published',
            finalScore: { $ne: null },
            timelineDate: dateRange,
          },
        },
        {
          $lookup: {
            from: 'classes',
            localField: 'classId',
            foreignField: '_id',
            as: 'class',
          },
        },
        { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$class.subject.name', 'Chưa phân môn'] },
            average_score: { $avg: '$finalScore' },
            records: { $sum: 1 },
            students: { $addToSet: '$studentId' },
          },
        },
        {
          $project: {
            _id: 0,
            subject: '$_id',
            average_score: { $round: ['$average_score', 1] },
            records: 1,
            students: { $size: '$students' },
          },
        },
        { $sort: { average_score: -1 } },
        { $limit: 8 },
      ]),
      Class.aggregate([
        { $match: { branchId, status: 'active', deletedAt: null } },
        {
          $project: {
            _id: 0,
            class_id: '$_id',
            name: 1,
            subject: '$subject.name',
            teacher: { $ifNull: ['$teacherSnapshot.fullName', 'Chưa phân công'] },
            students: '$studentCount',
            capacity: { $ifNull: ['$maxStudents', 0] },
            occupancy_rate: {
              $cond: [
                { $gt: [{ $ifNull: ['$maxStudents', 0] }, 0] },
                {
                  $round: [{ $multiply: [{ $divide: ['$studentCount', '$maxStudents'] }, 100] }, 1],
                },
                0,
              ],
            },
          },
        },
        { $sort: { students: -1 } },
        { $limit: 8 },
      ]),
      ClassSession.aggregate([
        {
          $match: {
            branchId,
            sessionDate: dateRange,
            status: { $ne: 'cancelled' },
            deletedAt: null,
          },
        },
        {
          $group: { _id: '$teacherId', sessions: { $sum: 1 }, classes: { $addToSet: '$classId' } },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'teacher',
          },
        },
        { $unwind: { path: '$teacher', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            teacher_id: '$_id',
            name: { $ifNull: ['$teacher.fullName', 'Chưa phân công'] },
            sessions: 1,
            classes: { $size: '$classes' },
          },
        },
        { $sort: { sessions: -1 } },
        { $limit: 6 },
      ]),
      ClassSession.aggregate([
        {
          $match: {
            branchId,
            sessionDate: dateRange,
            status: { $ne: 'cancelled' },
            deletedAt: null,
          },
        },
        {
          $group: {
            _id: { $ifNull: ['$roomCode', '$roomSnapshot.code'] },
            sessions: { $sum: 1 },
          },
        },
        { $project: { _id: 0, room: { $ifNull: ['$_id', 'Chưa xếp phòng'] }, sessions: 1 } },
        { $sort: { sessions: -1 } },
        { $limit: 6 },
      ]),
      Attendance.aggregate([
        { $match: { branchId, sessionDate: dateRange } },
        {
          $group: {
            _id: '$studentId',
            total: { $sum: 1 },
            absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          },
        },
        { $match: { absent: { $gt: 0 } } },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'student',
          },
        },
        { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            student_id: '$_id',
            name: { $ifNull: ['$student.fullName', 'Học sinh'] },
            code: { $ifNull: ['$student.userCode', ''] },
            absent: 1,
            total: 1,
            attendance_rate: {
              $round: [
                { $multiply: [{ $divide: [{ $subtract: ['$total', '$absent'] }, '$total'] }, 100] },
                1,
              ],
            },
          },
        },
        { $sort: { absent: -1, attendance_rate: 1 } },
        { $limit: 6 },
      ]),
    ]);

    const people = peopleSummary[0] ?? {};
    const finance = financeSummary[0] ?? {};
    const attendance = attendanceSummary[0] ?? {};
    const scores = scoreSummary[0] ?? {};
    const [activeClasses, upcomingClasses, activeRooms] = classSummary;
    const [newStudentTrend, leftStudentTrend] = studentGrowthTrend;
    const trendMap = new Map<string, Record<string, number | string>>();

    const mergeTrend = (
      rows: Array<Record<string, unknown>>,
      mapper?: (row: Record<string, unknown>) => Record<string, unknown>
    ) => {
      rows.forEach(row => {
        const key = String(row._id);
        const current = trendMap.get(key) ?? { key };
        Object.assign(current, mapper ? mapper(row) : row);
        delete current._id;
        trendMap.set(key, current as Record<string, number | string>);
      });
    };

    mergeTrend(financeTrend);
    mergeTrend(attendanceTrend, row => {
      const present = Number(row.present ?? 0);
      const absent = Number(row.absent ?? 0);
      return {
        present,
        absent,
        attendance_rate:
          present + absent ? Math.round((present / (present + absent)) * 1000) / 10 : 0,
      };
    });
    mergeTrend(newStudentTrend, row => ({ new_students: Number(row.count ?? 0) }));
    mergeTrend(leftStudentTrend, row => ({ left_students: Number(row.count ?? 0) }));
    mergeTrend(sessionTrend);

    const attendanceTotal = Number(attendance.total ?? 0);
    const revenue = Number(finance.revenue ?? 0);
    const invoicedAmount = Number(finance.invoiced_amount ?? 0);

    return {
      summary: {
        revenue,
        invoiced_amount: invoicedAmount,
        outstanding_amount: Number(finance.outstanding_amount ?? 0),
        collection_rate: invoicedAmount ? Math.round((revenue / invoicedAmount) * 1000) / 10 : 0,
        total_invoices: Number(finance.total_invoices ?? 0),
        paid_invoices: Number(finance.paid_invoices ?? 0),
        overdue_invoices: Number(finance.overdue_invoices ?? 0),
        active_students: Number(people.active_students ?? 0),
        new_students: Number(people.new_students ?? 0),
        left_students: leftStudentTrend.reduce((sum, row) => sum + Number(row.count ?? 0), 0),
        active_teachers: Number(people.active_teachers ?? 0),
        active_parents: Number(people.active_parents ?? 0),
        active_classes: activeClasses,
        upcoming_classes: upcomingClasses,
        active_rooms: activeRooms,
        total_sessions: sessionTrend.reduce((sum, row) => sum + Number(row.sessions ?? 0), 0),
        attendance_rate: attendanceTotal
          ? Math.round((Number(attendance.present ?? 0) / attendanceTotal) * 1000) / 10
          : 0,
        absent_count: Number(attendance.absent ?? 0),
        average_score: Math.round(Number(scores.average_score ?? 0) * 10) / 10,
        score_records: Number(scores.records ?? 0),
      },
      trends: Array.from(trendMap.values()).sort((a, b) =>
        String(a.key).localeCompare(String(b.key))
      ),
      distributions: {
        invoice_status: invoiceStatus.map(item => ({
          status: item._id,
          count: item.count,
          amount: item.amount,
        })),
        class_status: classStatus.map(item => ({ status: item._id, count: item.count })),
        session_status: sessionStatus.map(item => ({ status: item._id, count: item.count })),
      },
      subject_performance: subjectPerformance,
      top_classes: topClasses,
      teacher_workload: teacherWorkload,
      room_usage: roomUsage,
      attendance_risk: attendanceRisk,
    };
  }
}
