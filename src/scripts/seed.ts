import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.validation.js';
import { User } from '../models/user.model.js';
import { ROLES } from '../shared/constants/roles.js';

const seedData = async () => {
  try {
    console.log('Đang kết nối tới MongoDB...');
    await mongoose.connect(env.MONGODB_URI);
    console.log('✅ Kết nối thành công!');

    await User.deleteMany({});
    console.log('🧹 Đã dọn dẹp dữ liệu User cũ.');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Test@123', salt);

    const mockUsers = [
      {
        userCode: 'SYS001',
        username: 'sysadmin',
        email: 'admin@system.com',
        passwordHash, // Mật khẩu là Test@123
        role: ROLES.SYSTEM_OWNER,
        fullName: 'Quản trị viên Hệ thống',
        phone: '0901234567',
        isActive: true,
      },
      {
        userCode: 'STU001',
        username: 'student1',
        email: 'student@gmail.com',
        passwordHash, // Mật khẩu là Test@123
        role: ROLES.STUDENT,
        fullName: 'Nguyễn Văn Học Sinh',
        phone: '0988888888',
        isActive: true,
      }
    ];

    await User.insertMany(mockUsers);
    console.log('✅ Đã mock data thành công!');

  } catch (error) {
    console.error('❌ Lỗi khi mock data:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seedData();