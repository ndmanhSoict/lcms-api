import { Types } from 'mongoose';
import { Class } from '../../models/class.model.js';
import { Enrollment } from '../../models/enrollment.model.js';
import { Exam, IExam } from '../../models/exam.model.js';
import { ExamAttempt, IExamAttempt } from '../../models/examAttempt.model.js';
import { QuestionBank, IQuestionBank } from '../../models/questionBank.model.js';

export class ExamRepository {
  async findClassById(classId: string) {
    return await Class.findOne({ _id: classId, deletedAt: null }).lean();
  }

  async createQuestionBankItems(items: Partial<IQuestionBank>[]) {
    return await QuestionBank.insertMany(items);
  }

  async createExam(data: Partial<IExam>) {
    return await Exam.create(data);
  }

  async updateExam(id: string, data: MongoUpdate<IExam>) {
    return await Exam.findByIdAndUpdate(id, data, { new: true }).lean();
  }

  async findExamById(id: string) {
    return await Exam.findOne({ _id: id, deletedAt: null }).lean();
  }

  async findExamByIdWithClass(id: string) {
    return await Exam.findOne({ _id: id, deletedAt: null })
      .populate('classId', 'name classCode classType subject branchId teacherId studentCount')
      .lean();
  }

  async findTeacherExams(teacherId: string, branchId?: string) {
    return await Exam.find({
      teacherId,
      ...(branchId && { branchId }),
      deletedAt: null,
    })
      .populate('classId', 'name classCode classType subject')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findClassExams(classIds: Types.ObjectId[], branchId: string) {
    return await Exam.find({
      classId: { $in: classIds },
      branchId,
      deletedAt: null,
      status: { $in: ['published', 'closed'] },
    })
      .populate('classId', 'name classCode classType subject')
      .sort({ availableFrom: -1, createdAt: -1 })
      .lean();
  }

  async findExamsByClass(classId: string, branchId: string) {
    return await Exam.find({
      classId,
      branchId,
      deletedAt: null,
    })
      .populate('classId', 'name classCode classType subject')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findActiveEnrollment(studentId: string, classId: string, branchId?: string) {
    return await Enrollment.findOne({
      studentId,
      classId,
      ...(branchId && { branchId }),
      leftAt: null,
    }).lean();
  }

  async findStudentActiveEnrollments(studentId: string, branchId?: string) {
    return await Enrollment.find({
      studentId,
      ...(branchId && { branchId }),
      leftAt: null,
    }).lean();
  }

  async findAttemptByExamStudent(examId: string, studentId: string) {
    return await ExamAttempt.findOne({ examId, studentId }).lean();
  }

  async findAttemptDocByExamStudent(examId: string, studentId: string) {
    return await ExamAttempt.findOne({ examId, studentId });
  }

  async findAttemptDocById(attemptId: string) {
    return await ExamAttempt.findById(attemptId);
  }

  async createAttempt(data: Partial<IExamAttempt>) {
    return await ExamAttempt.create(data);
  }

  async incrementAttemptCount(examId: string) {
    await Exam.findByIdAndUpdate(examId, { $inc: { attemptCount: 1 } });
  }

  async findAttemptsByExam(examId: string, branchId: string) {
    return await ExamAttempt.find({ examId, branchId })
      .populate('studentId', 'fullName userCode email')
      .sort({ startedAt: 1 })
      .lean();
  }

  async findAttemptsByStudentForExams(studentId: string, examIds: Types.ObjectId[]) {
    return await ExamAttempt.find({
      studentId,
      examId: { $in: examIds },
    }).lean();
  }
}
