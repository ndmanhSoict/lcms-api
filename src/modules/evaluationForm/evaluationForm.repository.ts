import { Types } from 'mongoose';
import { Class } from '../../models/class.model.js';
import { ClassSession } from '../../models/classSession.model.js';
import { Enrollment } from '../../models/enrollment.model.js';
import { EvaluationForm, IEvaluationForm } from '../../models/evaluationForm.model.js';
import { User } from '../../models/user.model.js';

export class EvaluationFormRepository {
  async findClassById(classId: string) {
    return await Class.findOne({ _id: classId, deletedAt: null }).lean();
  }

  async findSessionById(sessionId: string) {
    return await ClassSession.findOne({ _id: sessionId, deletedAt: null }).lean();
  }

  async findStudentById(studentId: string) {
    return await User.findOne({ _id: studentId, deletedAt: null }).lean();
  }

  async findActiveEnrollment(studentId: string, classId: string) {
    return await Enrollment.findOne({
      studentId: new Types.ObjectId(studentId),
      classId: new Types.ObjectId(classId),
      leftAt: null,
    }).lean();
  }

  async create(data: Partial<IEvaluationForm>) {
    return await EvaluationForm.create(data);
  }

  async findById(id: string) {
    return await EvaluationForm.findById(id);
  }

  async findMany(filter: MongoFilter<IEvaluationForm>) {
    const branchMatch = filter.branchId ? { branchId: filter.branchId } : undefined;
    return await EvaluationForm.find(filter)
      .populate({
        path: 'studentId',
        select: 'fullName userCode email phone branchId',
        match: branchMatch,
      })
      .populate({
        path: 'classId',
        select: 'name classCode subject classType teacherSnapshot branchId',
        match: branchMatch,
      })
      .populate({
        path: 'sessionId',
        select: 'sessionDate startTime endTime roomCode status branchId',
        match: branchMatch,
      })
      .populate({ path: 'teacherId', select: 'fullName email branchId', match: branchMatch })
      .populate({ path: 'createdBy', select: 'fullName email role branchId', match: branchMatch })
      .sort({ createdAt: -1 })
      .lean();
  }
}
