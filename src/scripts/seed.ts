import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.validation.js';
import { User } from '../models/user.model.js';
import { Branch } from '../models/branch.model.js';
import { RefreshToken } from '../models/refreshToken.model.js';
import { ROLES } from '../shared/constants/roles.js';

const seedData = async () => {
  try {
    console.log('Đang kết nối tới MongoDB...');
    await mongoose.connect(env.MONGODB_URI);
    console.log('✅ Kết nối thành công!');

    // Xóa dữ liệu cũ
    await User.deleteMany({});
    await Branch.deleteMany({});
    await RefreshToken.deleteMany({});
    console.log('🧹 Đã dọn dẹp dữ liệu cũ (Users, Branches, RefreshTokens).');

    const salt = await bcrypt.genSalt(12); // Thiết kế yêu cầu bcrypt cost 12
    const passwordHash = await bcrypt.hash('Admin@123456', salt);

    // 2. Tạo mock Users
    const mockUsers = [
      {
        schemaVersion: 1,
        userCode: 'SO-0001',
        phone: '0900000000',
        email: 'admin@lcms.vn',
        username: 'system_owner',
        passwordHash, // Admin@123456
        role: ROLES.SYSTEM_OWNER,
        branchId: null, // System Owner không gắn branch
        fullName: 'System Owner',
        gender: 'other',
        isActive: true,
      },
      
    ];

    await User.insertMany(mockUsers);
    console.log('✅ Đã mock data Users thành công! (Mật khẩu mặc định: Admin@123456)');
  } catch (error) {
    console.error('❌ Lỗi khi mock data:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seedData();