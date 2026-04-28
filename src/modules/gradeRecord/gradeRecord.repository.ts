import { Types } from 'mongoose';
import { GradeRecord, IGradeRecord } from '../../models/gradeRecord.model.js';
import { Class } from '../../models/class.model.js';
import { User } from '../../models/user.model.js';

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

  async upsert(data: Partial<IGradeRecord> & { studentId: Types.ObjectId; classId: Types.ObjectId; academicPeriod: string }) {
    const { studentId, classId, academicPeriod, ...rest } = data;
    return await GradeRecord.findOneAndUpdate(
      { studentId, classId, academicPeriod },
      { $set: { ...rest, studentId, classId, academicPeriod } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async findByStudent(studentId: string, filter: Record<string, any>, includeUnpublished: boolean) {
    const query: Record<string, any> = { studentId, ...filter };
    if (!includeUnpublished) query.status = 'published';

    return await GradeRecord.find(query)
      .populate('classId', 'name subject classCode')
      .sort({ academicPeriod: -1 })
      .lean();
  }
}
