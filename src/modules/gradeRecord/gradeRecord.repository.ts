import { Types } from 'mongoose';
import {
  GradeRecord,
  IGradeRecord,
  IGradeAttendanceSummary,
  IHomeworkScore,
} from '../../models/gradeRecord.model.js';
import { Class } from '../../models/class.model.js';
import { User } from '../../models/user.model.js';
import { Attendance } from '../../models/attendance.model.js';
import { Submission } from '../../models/submission.model.js';
import { Enrollment } from '../../models/enrollment.model.js';

type AttendanceStatusCount = {
  _id: string;
  count: number;
};
type SubmissionScoreView = {
  assignmentId?:
    | Types.ObjectId
    | (NonNullable<PopulatedSubmissionSummary['assignmentId']> & { _id?: Types.ObjectId });
  score?: number;
  maxScore?: number;
  submittedAt?: Date;
  feedback?: string;
};

export class GradeRecordRepository {
  async findClassById(classId: string) {
    return await Class.findOne({ _id: classId, deletedAt: null }).lean();
  }

  async findStudentById(studentId: string) {
    return await User.findById(studentId).lean();
  }

  async findGradeRecord(studentId: string, classId: string, academicPeriod: string) {
    return await GradeRecord.findOne({ studentId, classId, academicPeriod });
  }

  async findGradeRecordById(id: string) {
    return await GradeRecord.findById(id);
  }

  async findActiveEnrollment(studentId: string, classId: string) {
    return await Enrollment.findOne({ studentId, classId, leftAt: null }).lean();
  }

  async upsert(
    data: Partial<IGradeRecord> & {
      studentId: Types.ObjectId;
      classId: Types.ObjectId;
      academicPeriod: string;
    }
  ) {
    const { studentId, classId, academicPeriod, ...rest } = data;
    return await GradeRecord.findOneAndUpdate(
      { studentId, classId, academicPeriod },
      { $set: { ...rest, studentId, classId, academicPeriod } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async findByStudent(
    studentId: string,
    filter: MongoFilter<IGradeRecord>,
    includeUnpublished: boolean
  ) {
    const query: MongoFilter<IGradeRecord> = { studentId, ...filter };
    const branchMatch = query.branchId ? { branchId: query.branchId } : undefined;
    if (!includeUnpublished) query.status = 'published';

    return await GradeRecord.find(query)
      .populate({ path: 'classId', select: 'name subject classCode branchId', match: branchMatch })
      .populate({ path: 'teacherId', select: 'fullName email branchId', match: branchMatch })
      .sort({ academicPeriod: -1 })
      .lean();
  }

  async findByClass(
    classId: string,
    filter: MongoFilter<IGradeRecord>,
    includeUnpublished: boolean
  ) {
    const query: MongoFilter<IGradeRecord> = { classId, ...filter };
    const branchMatch = query.branchId ? { branchId: query.branchId } : undefined;
    if (!includeUnpublished) query.status = 'published';

    return await GradeRecord.find(query)
      .populate({
        path: 'studentId',
        select: 'fullName userCode email phone branchId',
        match: branchMatch,
      })
      .populate({ path: 'classId', select: 'name subject classCode branchId', match: branchMatch })
      .populate({ path: 'teacherId', select: 'fullName email branchId', match: branchMatch })
      .sort({ academicPeriod: -1, updatedAt: -1 })
      .lean();
  }

  async getAttendanceSummary(studentId: string, classId: string): Promise<IGradeAttendanceSummary> {
    const rows = await Attendance.aggregate<AttendanceStatusCount>([
      {
        $match: {
          studentId: new Types.ObjectId(studentId),
          classId: new Types.ObjectId(classId),
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalSessions = rows.reduce((sum, row) => sum + row.count, 0);
    const presentCount = rows.find(row => row._id === 'present')?.count ?? 0;
    const absentCount = rows.find(row => row._id === 'absent')?.count ?? 0;
    const attendanceRate =
      totalSessions > 0 ? Math.round((presentCount / totalSessions) * 1000) / 10 : 0;

    return {
      totalSessions,
      presentCount,
      absentCount,
      attendanceRate,
    };
  }

  async getHomeworkScores(studentId: string, classId: string): Promise<IHomeworkScore[]> {
    const submissions = (await Submission.find({
      studentId,
      classId,
      status: 'graded',
    })
      .populate('assignmentId', 'title dueDate maxScore')
      .sort({ gradedAt: -1, submittedAt: -1 })
      .lean()) as SubmissionScoreView[];

    return submissions.map(submission => {
      const assignment =
        submission.assignmentId && !(submission.assignmentId instanceof Types.ObjectId)
          ? submission.assignmentId
          : undefined;
      return {
        assignmentId:
          assignment?._id ??
          (submission.assignmentId instanceof Types.ObjectId ? submission.assignmentId : undefined),
        title: assignment?.title ?? 'Bài tập',
        score: submission.score ?? undefined,
        maxScore: submission.maxScore ?? assignment?.maxScore ?? undefined,
        dueDate: assignment?.dueDate ?? undefined,
        submittedAt: submission.submittedAt ?? undefined,
        feedback: submission.feedback ?? undefined,
      };
    });
  }
}
