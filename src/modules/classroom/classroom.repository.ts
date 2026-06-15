import { Types } from 'mongoose';
import { Classroom, IClassroom } from '../../models/classroom.model.js';
import { Class } from '../../models/class.model.js';
import { ClassSession } from '../../models/classSession.model.js';

export class ClassroomRepository {
  async create(data: Partial<IClassroom>) {
    const classroom = new Classroom(data);
    return await classroom.save();
  }

  async findById(id: string) {
    return await Classroom.findOne({ _id: id, deletedAt: null }).lean();
  }

  async findByCode(branchId: string | Types.ObjectId, code: string, excludeId?: string) {
    return await Classroom.findOne({
      branchId,
      code,
      deletedAt: null,
      ...(excludeId && { _id: { $ne: excludeId } }),
    }).lean();
  }

  async findPaginated(filter: MongoFilter<IClassroom>, skip: number, limit: number) {
    const query = Classroom.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
    const [classrooms, totalItems] = await Promise.all([
      query.lean(),
      Classroom.countDocuments(filter),
    ]);

    return { classrooms, totalItems };
  }

  async updateById(id: string, data: MongoUpdate<IClassroom>) {
    return await Classroom.findOneAndUpdate({ _id: id, deletedAt: null }, data, {
      new: true,
    }).lean();
  }

  async hasActiveClassUsage(roomId: string) {
    const count = await Class.countDocuments({
      roomId,
      deletedAt: null,
      status: { $in: ['active', 'upcoming'] },
    });
    return count > 0;
  }

  async hasFutureSessionUsage(roomId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await ClassSession.countDocuments({
      roomId,
      deletedAt: null,
      status: { $ne: 'cancelled' },
      sessionDate: { $gte: today },
    });
    return count > 0;
  }
}
