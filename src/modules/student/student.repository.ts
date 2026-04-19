import { User, IUser } from '../../models/user.model.js';
import { ClientSession, Types } from 'mongoose';
import '../../models/class.model.js';
import { ROLES } from '../../shared/constants/roles.js';

export class StudentRepository {
  // Tạo user trong một session (dùng cho transaction)
  async createUserWithSession(data: Partial<IUser>, session: ClientSession) {
    const user = new User(data);
    return await user.save({ session });
  }

  async findById(id: string) {
    return await User.findById(id).lean();
  }

  // Lấy danh sách học sinh kèm thông tin lớp học (Aggregate)
  async findAllStudents(filter: any, skip: number, limit: number) {
    const query = User.find({ ...filter, role: ROLES.STUDENT })
      .populate('studentInfo.activeClassIds', 'name subject')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const [students, totalItems] = await Promise.all([
      query.lean(),
      User.countDocuments({ ...filter, role: ROLES.STUDENT })
    ]);

    return { students, totalItems };
  }

  async updateById(id: string, data: any, session?: ClientSession) {
    return await User.findByIdAndUpdate(id, data, { new: true, session }).lean();
  }

  // Tìm nạp thông tin phụ huynh và lớp học cho chi tiết học sinh
  async getStudentDetail(id: string) {
    return await User.findOne({ _id: id, role: ROLES.STUDENT })
      .populate({
        path: 'studentInfo.parentIds',
        select: 'fullName phone email parentInfo'
      })
      .populate({
        path: 'studentInfo.activeClassIds',
        select: 'name subject teacherId',
        populate: { path: 'teacherId', select: 'fullName' }
      })
      .lean();
  }
}