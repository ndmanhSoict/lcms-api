import { Types } from 'mongoose';
import { ClassAnnouncement, IClassAnnouncement } from '../../models/classAnnouncement.model.js';
import { Class } from '../../models/class.model.js';
import { Enrollment } from '../../models/enrollment.model.js';
import { User } from '../../models/user.model.js';

export class ClassAnnouncementRepository {
  async findClassById(classId: string) {
    return await Class.findOne({ _id: classId, deletedAt: null }).lean();
  }

  async findActiveEnrollment(studentId: string, classId: string) {
    return await Enrollment.findOne({ studentId, classId, leftAt: null }).lean();
  }

  async findChildEnrollmentInClass(childIds: string[], classId: string) {
    return await Enrollment.findOne({
      studentId: { $in: childIds.map(id => new Types.ObjectId(id)) },
      classId,
      leftAt: null,
    }).lean();
  }

  async findParentById(parentId: string) {
    return await User.findById(parentId).lean();
  }

  async create(data: Partial<IClassAnnouncement>) {
    return await ClassAnnouncement.create(data);
  }

  async findByClass(classId: string, skip: number, limit: number) {
    const query = { classId, deletedAt: null };
    const [items, total] = await Promise.all([
      ClassAnnouncement.find(query)
        .populate('authorId', 'fullName')
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ClassAnnouncement.countDocuments(query),
    ]);
    return { items, total };
  }
}
