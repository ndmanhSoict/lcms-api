import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.validation.js';
import { User } from '../models/user.model.js';
import { Branch } from '../models/branch.model.js';
import { ROLES } from '../shared/constants/roles.js';
import { Class } from '../models/class.model.js';
import { Enrollment } from '../models/enrollment.model.js';
import { ClassSession } from '../models/classSession.model.js';
import { Attendance } from '../models/attendance.model.js';
import { Assignment } from '../models/assignment.model.js';
import { Submission } from '../models/submission.model.js';
import { QuestionBank } from '../models/questionBank.model.js';
import { Invoice } from '../models/invoice.model.js';
import { Payment } from '../models/payment.model.js';
import { AuditLog } from '../models/auditLog.model.js';
import { Message } from '../models/message.model.js';
import { ClassAnnouncement } from '../models/classAnnouncement.model.js';
import { Exam } from '../models/exam.model.js';
import { ExamAttempt } from '../models/examAttempt.model.js';
import { Notification } from '../models/notification.model.js';
// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════
const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
};
const daysFromNow = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
};
const addDays = (date, n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
};
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
// ════════════════════════════════════════════════════════════
// MAIN SEED
// ════════════════════════════════════════════════════════════
const seedData = async () => {
    try {
        console.log('Đang kết nối tới MongoDB...');
        await mongoose.connect(env.MONGODB_URI);
        console.log('✅ Kết nối thành công!\n');
        // ── Xóa data cũ ────────────────────────────────────────
        await Promise.all([
            User.deleteMany({}),
            Branch.deleteMany({}),
            Class.deleteMany({}),
            ClassSession.deleteMany({}),
            Enrollment.deleteMany({}),
            Attendance.deleteMany({}),
            Assignment.deleteMany({}),
            Submission.deleteMany({}),
            QuestionBank.deleteMany({}),
            Exam.deleteMany({}),
            ExamAttempt.deleteMany({}),
            Invoice.deleteMany({}),
            Payment.deleteMany({}),
            Notification.deleteMany({}),
            Message.deleteMany({}),
            ClassAnnouncement.deleteMany({}),
            AuditLog.deleteMany({}),
        ]);
        console.log('🧹 Đã dọn dẹp toàn bộ data cũ.\n');
        // ── Bcrypt hash chung (cost 12 theo thiết kế) ──────────
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash('Admin@123456', salt);
        // ════════════════════════════════════════════════════════
        // 1. BRANCHES
        // ════════════════════════════════════════════════════════
        const branchHBT = new Types.ObjectId();
        const branchCG = new Types.ObjectId();
        await Branch.insertMany([
            {
                _id: branchHBT,
                schemaVersion: 1,
                branchCode: 'CS-HBT',
                name: 'Cơ sở Hai Bà Trưng',
                address: '45 Phố Huế, Hai Bà Trưng, Hà Nội',
                phone: '024-3821-4567',
                email: 'haibatruong@lcms.edu.vn',
                logoUrl: null,
                ownerId: null, // cập nhật sau khi tạo branch_owner
                timezone: 'Asia/Ho_Chi_Minh',
                defaultFeePerSession: 150000,
                defaultSessionSlots: [
                    { name: 'Ca sáng', startTime: '07:30', endTime: '09:30' },
                    { name: 'Ca chiều', startTime: '14:00', endTime: '16:00' },
                    { name: 'Ca tối', startTime: '18:00', endTime: '20:00' },
                ],
                rooms: [
                    { code: 'P101', name: 'Phòng 101', capacity: 25 },
                    { code: 'P102', name: 'Phòng 102', capacity: 20 },
                    { code: 'P201', name: 'Phòng 201', capacity: 30 },
                ],
                isActive: true,
                createdAt: daysAgo(180),
                updatedAt: daysAgo(10),
                deletedAt: null,
            },
            {
                _id: branchCG,
                schemaVersion: 1,
                branchCode: 'CS-CG',
                name: 'Cơ sở Cầu Giấy',
                address: '18 Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
                phone: '024-3756-8901',
                email: 'caugiay@lcms.edu.vn',
                logoUrl: null,
                ownerId: null,
                timezone: 'Asia/Ho_Chi_Minh',
                defaultFeePerSession: 160000,
                defaultSessionSlots: [
                    { name: 'Ca sáng', startTime: '08:00', endTime: '10:00' },
                    { name: 'Ca chiều', startTime: '14:30', endTime: '16:30' },
                    { name: 'Ca tối', startTime: '18:30', endTime: '20:30' },
                ],
                rooms: [
                    { code: 'A01', name: 'Phòng A01', capacity: 30 },
                    { code: 'A02', name: 'Phòng A02', capacity: 25 },
                    { code: 'B01', name: 'Phòng B01', capacity: 20 },
                ],
                isActive: true,
                createdAt: daysAgo(120),
                updatedAt: daysAgo(5),
                deletedAt: null,
            },
        ]);
        console.log('✅ Branches: 2');
        // ════════════════════════════════════════════════════════
        // 2. USERS — System Owner
        // ════════════════════════════════════════════════════════
        const soId = new Types.ObjectId();
        await User.insertOne({
            _id: soId,
            schemaVersion: 1,
            userCode: 'SO-0001',
            email: 'admin@lcms.vn',
            phone: null,
            passwordHash,
            role: ROLES.SYSTEM_OWNER,
            branchId: null,
            fullName: 'System Owner',
            dateOfBirth: null,
            gender: 'other',
            avatarUrl: null,
            isActive: true,
            lastLoginAt: null,
            createdAt: daysAgo(200),
            updatedAt: daysAgo(200),
            createdBy: null,
            deletedAt: null,
            deletedBy: null,
        });
        // ════════════════════════════════════════════════════════
        // 3. USERS — Branch Owners
        // ════════════════════════════════════════════════════════
        const boHBT = new Types.ObjectId();
        const boCG = new Types.ObjectId();
        await User.insertMany([
            {
                _id: boHBT,
                schemaVersion: 1,
                userCode: 'BO-0001',
                email: 'nguyen.thu.hoa@lcms.edu.vn',
                phone: '0912111001',
                passwordHash,
                role: ROLES.BRANCH_OWNER,
                branchId: branchHBT,
                fullName: 'Nguyễn Thu Hoa',
                dateOfBirth: new Date('1980-05-12'),
                gender: 'female',
                avatarUrl: null,
                isActive: true,
                lastLoginAt: daysAgo(1),
                createdAt: daysAgo(180),
                updatedAt: daysAgo(1),
                createdBy: soId,
                deletedAt: null,
                deletedBy: null,
            },
            {
                _id: boCG,
                schemaVersion: 1,
                userCode: 'BO-0002',
                email: 'tran.duc.manh@lcms.edu.vn',
                phone: '0912111002',
                passwordHash,
                role: ROLES.BRANCH_OWNER,
                branchId: branchCG,
                fullName: 'Trần Đức Mạnh',
                dateOfBirth: new Date('1978-11-20'),
                gender: 'male',
                avatarUrl: null,
                isActive: true,
                lastLoginAt: daysAgo(2),
                createdAt: daysAgo(120),
                updatedAt: daysAgo(2),
                createdBy: soId,
                deletedAt: null,
                deletedBy: null,
            },
        ]);
        // Gắn ownerId vào branch
        await Branch.updateOne({ _id: branchHBT }, { $set: { ownerId: boHBT } });
        await Branch.updateOne({ _id: branchCG }, { $set: { ownerId: boCG } });
        // ════════════════════════════════════════════════════════
        // 4. USERS — Staff
        // ════════════════════════════════════════════════════════
        const staffHBT1 = new Types.ObjectId();
        const staffHBT2 = new Types.ObjectId();
        const staffCG1 = new Types.ObjectId();
        const staffCG2 = new Types.ObjectId();
        await User.insertMany([
            {
                _id: staffHBT1, schemaVersion: 1, userCode: 'ST-0001',
                email: 'le.phuong@lcms.edu.vn', phone: '0912222001', passwordHash,
                role: ROLES.STAFF, branchId: branchHBT,
                fullName: 'Lê Thị Phương', dateOfBirth: new Date('1990-03-18'), gender: 'female',
                avatarUrl: null, isActive: true, lastLoginAt: daysAgo(1),
                createdAt: daysAgo(160), updatedAt: daysAgo(1), createdBy: boHBT, deletedAt: null, deletedBy: null,
            },
            {
                _id: staffHBT2, schemaVersion: 1, userCode: 'ST-0002',
                email: 'pham.duc@lcms.edu.vn', phone: '0912222002', passwordHash,
                role: ROLES.STAFF, branchId: branchHBT,
                fullName: 'Phạm Văn Đức', dateOfBirth: new Date('1992-07-25'), gender: 'male',
                avatarUrl: null, isActive: true, lastLoginAt: daysAgo(2),
                createdAt: daysAgo(160), updatedAt: daysAgo(1), createdBy: boHBT, deletedAt: null, deletedBy: null,
            },
            {
                _id: staffCG1, schemaVersion: 1, userCode: 'ST-0003',
                email: 'hoang.lan@lcms.edu.vn', phone: '0912222003', passwordHash,
                role: ROLES.STAFF, branchId: branchCG,
                fullName: 'Hoàng Thị Lan', dateOfBirth: new Date('1991-01-10'), gender: 'female',
                avatarUrl: null, isActive: true, lastLoginAt: daysAgo(1),
                createdAt: daysAgo(110), updatedAt: daysAgo(1), createdBy: boCG, deletedAt: null, deletedBy: null,
            },
            {
                _id: staffCG2, schemaVersion: 1, userCode: 'ST-0004',
                email: 'vu.tuan@lcms.edu.vn', phone: '0912222004', passwordHash,
                role: ROLES.STAFF, branchId: branchCG,
                fullName: 'Vũ Minh Tuấn', dateOfBirth: new Date('1993-09-05'), gender: 'male',
                avatarUrl: null, isActive: true, lastLoginAt: daysAgo(3),
                createdAt: daysAgo(110), updatedAt: daysAgo(1), createdBy: boCG, deletedAt: null, deletedBy: null,
            },
        ]);
        console.log('✅ Staff: 4');
        // ════════════════════════════════════════════════════════
        // 5. USERS — Teachers
        // ════════════════════════════════════════════════════════
        const tc = {
            hungHBT: new Types.ObjectId(),
            maiHBT: new Types.ObjectId(),
            chauHBT: new Types.ObjectId(),
            baoHBT: new Types.ObjectId(),
            huongCG: new Types.ObjectId(),
            longCG: new Types.ObjectId(),
            thanhCG: new Types.ObjectId(),
            truongCG: new Types.ObjectId(),
        };
        const teacherDefs = [
            { _id: tc.hungHBT, code: 'TC-0001', email: 'hung.nguyen@lcms.edu.vn', phone: '0912333001', name: 'Nguyễn Văn Hùng', dob: '1985-04-22', gender: 'male', branch: branchHBT, subjects: ['Toán học'], createdBy: boHBT },
            { _id: tc.maiHBT, code: 'TC-0002', email: 'mai.tran@lcms.edu.vn', phone: '0912333002', name: 'Trần Thị Mai', dob: '1988-08-15', gender: 'female', branch: branchHBT, subjects: ['Toán học', 'Vật Lý'], createdBy: boHBT },
            { _id: tc.chauHBT, code: 'TC-0003', email: 'chau.le@lcms.edu.vn', phone: '0912333003', name: 'Lê Minh Châu', dob: '1986-12-03', gender: 'female', branch: branchHBT, subjects: ['Tiếng Anh'], createdBy: boHBT },
            { _id: tc.baoHBT, code: 'TC-0004', email: 'bao.pham@lcms.edu.vn', phone: '0912333004', name: 'Phạm Quốc Bảo', dob: '1983-06-19', gender: 'male', branch: branchHBT, subjects: ['Ngữ Văn'], createdBy: boHBT },
            { _id: tc.huongCG, code: 'TC-0005', email: 'huong.hoang@lcms.edu.vn', phone: '0912333005', name: 'Hoàng Thị Hương', dob: '1987-02-28', gender: 'female', branch: branchCG, subjects: ['Tiếng Anh'], createdBy: boCG },
            { _id: tc.longCG, code: 'TC-0006', email: 'long.dinh@lcms.edu.vn', phone: '0912333006', name: 'Đinh Văn Long', dob: '1984-10-11', gender: 'male', branch: branchCG, subjects: ['Toán học', 'Hóa Học'], createdBy: boCG },
            { _id: tc.thanhCG, code: 'TC-0007', email: 'thanh.bui@lcms.edu.vn', phone: '0912333007', name: 'Bùi Thị Thanh', dob: '1989-07-07', gender: 'female', branch: branchCG, subjects: ['Vật Lý', 'Hóa Học'], createdBy: boCG },
            { _id: tc.truongCG, code: 'TC-0008', email: 'truong.ngo@lcms.edu.vn', phone: '0912333008', name: 'Ngô Xuân Trường', dob: '1982-03-14', gender: 'male', branch: branchCG, subjects: ['Ngữ Văn'], createdBy: boCG },
        ];
        await User.insertMany(teacherDefs.map(t => ({
            _id: t._id, schemaVersion: 1, userCode: t.code,
            email: t.email, phone: t.phone, passwordHash,
            role: ROLES.TEACHER, branchId: t.branch,
            fullName: t.name, dateOfBirth: new Date(t.dob), gender: t.gender,
            avatarUrl: null,
            teacherInfo: {
                subjects: t.subjects,
                joinDate: daysAgo(180),
                activeClassIds: [], // cập nhật sau khi tạo classes
            },
            isActive: true, lastLoginAt: daysAgo(randInt(0, 2)),
            createdAt: daysAgo(170), updatedAt: daysAgo(1),
            createdBy: t.createdBy, deletedAt: null, deletedBy: null,
        })));
        console.log('✅ Teachers: 8');
        // ════════════════════════════════════════════════════════
        // 6. CLASSES — 10 lớp
        // ════════════════════════════════════════════════════════
        const cls = {
            toan8a: new Types.ObjectId(),
            toan9a: new Types.ObjectId(),
            anh7a: new Types.ObjectId(),
            anh8b: new Types.ObjectId(),
            van8a: new Types.ObjectId(),
            ly9a: new Types.ObjectId(),
            hoa9b: new Types.ObjectId(),
            toanCG: new Types.ObjectId(),
            anhCG: new Types.ObjectId(),
            vanCG: new Types.ObjectId(),
        };
        const classDefs = [
            // ── CS Hai Bà Trưng ─────────────────────────────────
            {
                _id: cls.toan8a, branchId: branchHBT,
                subject: { name: 'Toán học', code: 'TOAN', color: '#4F8EF7', icon: '📐' },
                name: 'Toán 8A', classCode: 'HBT-TOAN-8A-2025',
                description: 'Toán nâng cao dành cho học sinh lớp 8',
                teacherId: tc.hungHBT,
                teacherSnapshot: { fullName: 'Nguyễn Văn Hùng', avatarUrl: null },
                classType: 'ongoing',
                courseInfo: null,
                ongoingInfo: { feePerSession: 150000, billingCycle: 'monthly' },
                weeklySchedule: [
                    { dayOfWeek: 2, startTime: '18:00', endTime: '20:00', roomCode: 'P101' },
                    { dayOfWeek: 5, startTime: '18:00', endTime: '20:00', roomCode: 'P101' },
                ],
                maxStudents: 20, studentCount: 0, status: 'active',
                createdBy: boHBT, createdAt: daysAgo(90),
            },
            {
                _id: cls.toan9a, branchId: branchHBT,
                subject: { name: 'Toán học', code: 'TOAN', color: '#4F8EF7', icon: '📐' },
                name: 'Toán 9A', classCode: 'HBT-TOAN-9A-2025',
                description: 'Luyện thi vào 10 THPT',
                teacherId: tc.maiHBT,
                teacherSnapshot: { fullName: 'Trần Thị Mai', avatarUrl: null },
                classType: 'course',
                courseInfo: { startDate: daysAgo(60), endDate: daysFromNow(60), totalSessions: 40, completedSessions: 20, feePerCourse: 3500000 },
                ongoingInfo: null,
                weeklySchedule: [
                    { dayOfWeek: 3, startTime: '18:00', endTime: '20:00', roomCode: 'P201' },
                    { dayOfWeek: 6, startTime: '08:00', endTime: '10:00', roomCode: 'P201' },
                ],
                maxStudents: 18, studentCount: 0, status: 'active',
                createdBy: boHBT, createdAt: daysAgo(65),
            },
            {
                _id: cls.anh7a, branchId: branchHBT,
                subject: { name: 'Tiếng Anh', code: 'ANH', color: '#F59E0B', icon: '🌏' },
                name: 'Anh Văn 7A', classCode: 'HBT-ANH-7A-2025',
                description: 'Tiếng Anh giao tiếp cho học sinh lớp 7',
                teacherId: tc.chauHBT,
                teacherSnapshot: { fullName: 'Lê Minh Châu', avatarUrl: null },
                classType: 'ongoing',
                courseInfo: null,
                ongoingInfo: { feePerSession: 150000, billingCycle: 'monthly' },
                weeklySchedule: [
                    { dayOfWeek: 1, startTime: '18:00', endTime: '20:00', roomCode: 'P102' },
                    { dayOfWeek: 4, startTime: '18:00', endTime: '20:00', roomCode: 'P102' },
                ],
                maxStudents: 20, studentCount: 0, status: 'active',
                createdBy: boHBT, createdAt: daysAgo(80),
            },
            {
                _id: cls.anh8b, branchId: branchHBT,
                subject: { name: 'Tiếng Anh', code: 'ANH', color: '#F59E0B', icon: '🌏' },
                name: 'Anh Văn 8B', classCode: 'HBT-ANH-8B-2025',
                description: 'Tiếng Anh nâng cao lớp 8',
                teacherId: tc.chauHBT,
                teacherSnapshot: { fullName: 'Lê Minh Châu', avatarUrl: null },
                classType: 'ongoing',
                courseInfo: null,
                ongoingInfo: { feePerSession: 150000, billingCycle: 'monthly' },
                weeklySchedule: [
                    { dayOfWeek: 2, startTime: '14:00', endTime: '16:00', roomCode: 'P102' },
                    { dayOfWeek: 6, startTime: '14:00', endTime: '16:00', roomCode: 'P102' },
                ],
                maxStudents: 18, studentCount: 0, status: 'active',
                createdBy: boHBT, createdAt: daysAgo(75),
            },
            {
                _id: cls.van8a, branchId: branchHBT,
                subject: { name: 'Ngữ Văn', code: 'VAN', color: '#10B981', icon: '📖' },
                name: 'Văn 8A', classCode: 'HBT-VAN-8A-2025',
                description: 'Ngữ văn lớp 8',
                teacherId: tc.baoHBT,
                teacherSnapshot: { fullName: 'Phạm Quốc Bảo', avatarUrl: null },
                classType: 'ongoing',
                courseInfo: null,
                ongoingInfo: { feePerSession: 140000, billingCycle: 'monthly' },
                weeklySchedule: [
                    { dayOfWeek: 3, startTime: '14:00', endTime: '16:00', roomCode: 'P201' },
                    { dayOfWeek: 5, startTime: '14:00', endTime: '16:00', roomCode: 'P201' },
                ],
                maxStudents: 22, studentCount: 0, status: 'active',
                createdBy: boHBT, createdAt: daysAgo(70),
            },
            // ── CS Cầu Giấy ─────────────────────────────────────
            {
                _id: cls.ly9a, branchId: branchCG,
                subject: { name: 'Vật Lý', code: 'LY', color: '#7C3AED', icon: '⚡' },
                name: 'Vật Lý 9A', classCode: 'CG-LY-9A-2025',
                description: 'Vật lý luyện thi vào 10',
                teacherId: tc.thanhCG,
                teacherSnapshot: { fullName: 'Bùi Thị Thanh', avatarUrl: null },
                classType: 'course',
                courseInfo: { startDate: daysAgo(50), endDate: daysFromNow(70), totalSessions: 36, completedSessions: 18, feePerCourse: 3200000 },
                ongoingInfo: null,
                weeklySchedule: [
                    { dayOfWeek: 2, startTime: '18:30', endTime: '20:30', roomCode: 'A01' },
                    { dayOfWeek: 5, startTime: '18:30', endTime: '20:30', roomCode: 'A01' },
                ],
                maxStudents: 20, studentCount: 0, status: 'active',
                createdBy: boCG, createdAt: daysAgo(55),
            },
            {
                _id: cls.hoa9b, branchId: branchCG,
                subject: { name: 'Hóa Học', code: 'HOA', color: '#EF4444', icon: '🧪' },
                name: 'Hóa 9B', classCode: 'CG-HOA-9B-2025',
                description: 'Hóa học nâng cao lớp 9',
                teacherId: tc.longCG,
                teacherSnapshot: { fullName: 'Đinh Văn Long', avatarUrl: null },
                classType: 'ongoing',
                courseInfo: null,
                ongoingInfo: { feePerSession: 160000, billingCycle: 'monthly' },
                weeklySchedule: [
                    { dayOfWeek: 3, startTime: '18:30', endTime: '20:30', roomCode: 'B01' },
                    { dayOfWeek: 6, startTime: '08:00', endTime: '10:00', roomCode: 'B01' },
                ],
                maxStudents: 18, studentCount: 0, status: 'active',
                createdBy: boCG, createdAt: daysAgo(60),
            },
            {
                _id: cls.toanCG, branchId: branchCG,
                subject: { name: 'Toán học', code: 'TOAN', color: '#4F8EF7', icon: '📐' },
                name: 'Toán 8C', classCode: 'CG-TOAN-8C-2025',
                description: 'Toán học lớp 8 cơ sở Cầu Giấy',
                teacherId: tc.longCG,
                teacherSnapshot: { fullName: 'Đinh Văn Long', avatarUrl: null },
                classType: 'ongoing',
                courseInfo: null,
                ongoingInfo: { feePerSession: 160000, billingCycle: 'monthly' },
                weeklySchedule: [
                    { dayOfWeek: 1, startTime: '18:30', endTime: '20:30', roomCode: 'A02' },
                    { dayOfWeek: 4, startTime: '18:30', endTime: '20:30', roomCode: 'A02' },
                ],
                maxStudents: 20, studentCount: 0, status: 'active',
                createdBy: boCG, createdAt: daysAgo(85),
            },
            {
                _id: cls.anhCG, branchId: branchCG,
                subject: { name: 'Tiếng Anh', code: 'ANH', color: '#F59E0B', icon: '🌏' },
                name: 'Anh Văn 9C', classCode: 'CG-ANH-9C-2025',
                description: 'Tiếng Anh luyện thi lớp 9',
                teacherId: tc.huongCG,
                teacherSnapshot: { fullName: 'Hoàng Thị Hương', avatarUrl: null },
                classType: 'course',
                courseInfo: { startDate: daysAgo(45), endDate: daysFromNow(75), totalSessions: 32, completedSessions: 14, feePerCourse: 2800000 },
                ongoingInfo: null,
                weeklySchedule: [
                    { dayOfWeek: 2, startTime: '14:30', endTime: '16:30', roomCode: 'A01' },
                    { dayOfWeek: 5, startTime: '14:30', endTime: '16:30', roomCode: 'A01' },
                ],
                maxStudents: 20, studentCount: 0, status: 'active',
                createdBy: boCG, createdAt: daysAgo(50),
            },
            {
                _id: cls.vanCG, branchId: branchCG,
                subject: { name: 'Ngữ Văn', code: 'VAN', color: '#10B981', icon: '📖' },
                name: 'Văn 9D', classCode: 'CG-VAN-9D-2025',
                description: 'Ngữ Văn lớp 9 cơ sở Cầu Giấy',
                teacherId: tc.truongCG,
                teacherSnapshot: { fullName: 'Ngô Xuân Trường', avatarUrl: null },
                classType: 'ongoing',
                courseInfo: null,
                ongoingInfo: { feePerSession: 155000, billingCycle: 'monthly' },
                weeklySchedule: [
                    { dayOfWeek: 3, startTime: '14:30', endTime: '16:30', roomCode: 'A02' },
                    { dayOfWeek: 6, startTime: '14:30', endTime: '16:30', roomCode: 'A02' },
                ],
                maxStudents: 22, studentCount: 0, status: 'active',
                createdBy: boCG, createdAt: daysAgo(72),
            },
        ];
        await Class.insertMany(classDefs.map(c => ({
            ...c,
            schemaVersion: 1,
            coTeacherIds: [],
            updatedAt: daysAgo(1),
            deletedAt: null,
        })));
        // Cập nhật activeClassIds cho từng GV
        const teacherClassMap = {
            [tc.hungHBT.toString()]: [cls.toan8a],
            [tc.maiHBT.toString()]: [cls.toan9a],
            [tc.chauHBT.toString()]: [cls.anh7a, cls.anh8b],
            [tc.baoHBT.toString()]: [cls.van8a],
            [tc.huongCG.toString()]: [cls.anhCG],
            [tc.longCG.toString()]: [cls.hoa9b, cls.toanCG],
            [tc.thanhCG.toString()]: [cls.ly9a],
            [tc.truongCG.toString()]: [cls.vanCG],
        };
        for (const [teacherId, classIds] of Object.entries(teacherClassMap)) {
            await User.updateOne({ _id: new Types.ObjectId(teacherId) }, { $set: { 'teacherInfo.activeClassIds': classIds } });
        }
        console.log('✅ Classes: 10 | Teacher activeClassIds: cập nhật xong');
        const studentRaw = [
            // CS Hai Bà Trưng — 30 HS
            { name: 'Nguyễn Minh Anh', dob: '2010-01-15', gender: 'female', school: 'THCS Hai Bà Trưng', grade: 7, parentName: 'Nguyễn Văn Thắng', parentPhone: '0912444001', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'Trần Hoàng Nam', dob: '2009-03-22', gender: 'male', school: 'THCS Nguyễn Du', grade: 8, parentName: 'Trần Thị Hạnh', parentPhone: '0912444002', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'Lê Thị Thu Hà', dob: '2010-05-10', gender: 'female', school: 'THCS Hai Bà Trưng', grade: 7, parentName: 'Lê Đình Quang', parentPhone: '0912444003', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'Phạm Đức Khoa', dob: '2008-07-18', gender: 'male', school: 'THCS Lê Ngọc Hân', grade: 9, parentName: 'Phạm Thị Nga', parentPhone: '0912444004', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'Hoàng Như Ngọc', dob: '2009-09-05', gender: 'female', school: 'THCS Nguyễn Du', grade: 8, parentName: 'Hoàng Văn Sơn', parentPhone: '0912444005', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'Vũ Trọng Khải', dob: '2010-11-12', gender: 'male', school: 'THCS Hai Bà Trưng', grade: 7, parentName: 'Vũ Thị Hòa', parentPhone: '0912444006', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'Đỗ Thị Phương Linh', dob: '2008-02-28', gender: 'female', school: 'THCS Lê Ngọc Hân', grade: 9, parentName: 'Đỗ Văn Cường', parentPhone: '0912444007', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'Bùi Hải Đăng', dob: '2009-04-20', gender: 'male', school: 'THCS Nguyễn Du', grade: 8, parentName: 'Bùi Thị Thủy', parentPhone: '0912444008', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'Đinh Thu Trang', dob: '2010-06-14', gender: 'female', school: 'THCS Hai Bà Trưng', grade: 7, parentName: 'Đinh Văn Hải', parentPhone: '0912444009', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'Ngô Việt Anh', dob: '2008-08-30', gender: 'male', school: 'THCS Lê Ngọc Hân', grade: 9, parentName: 'Ngô Thị Bích', parentPhone: '0912444010', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'Dương Khánh Linh', dob: '2009-10-08', gender: 'female', school: 'THCS Nguyễn Du', grade: 8, parentName: 'Dương Văn Hùng', parentPhone: '0912444011', branch: branchHBT, createdBy: staffHBT2 },
            { name: 'Mai Xuân Hưng', dob: '2010-12-25', gender: 'male', school: 'THCS Hai Bà Trưng', grade: 7, parentName: 'Mai Thị Loan', parentPhone: '0912444012', branch: branchHBT, createdBy: staffHBT2 },
            { name: 'Lý Thị Mỹ Duyên', dob: '2008-01-09', gender: 'female', school: 'THCS Lê Ngọc Hân', grade: 9, parentName: 'Lý Văn Tú', parentPhone: '0912444013', branch: branchHBT, createdBy: staffHBT2 },
            { name: 'Tô Văn Thịnh', dob: '2009-03-17', gender: 'male', school: 'THCS Nguyễn Du', grade: 8, parentName: 'Tô Thị Hương', parentPhone: '0912444014', branch: branchHBT, createdBy: staffHBT2 },
            { name: 'Cao Ngọc Hà', dob: '2010-05-23', gender: 'female', school: 'THCS Hai Bà Trưng', grade: 7, parentName: 'Cao Văn Bình', parentPhone: '0912444015', branch: branchHBT, createdBy: staffHBT2 },
            { name: 'Võ Minh Tiến', dob: '2008-07-04', gender: 'male', school: 'THCS Lê Ngọc Hân', grade: 9, parentName: 'Võ Thị Lan', parentPhone: '0912444016', branch: branchHBT, createdBy: staffHBT2 },
            { name: 'Hà Thanh Vân', dob: '2009-09-19', gender: 'female', school: 'THCS Nguyễn Du', grade: 8, parentName: 'Hà Văn Nghĩa', parentPhone: '0912444017', branch: branchHBT, createdBy: staffHBT2 },
            { name: 'Chu Đình Lâm', dob: '2010-11-02', gender: 'male', school: 'THCS Hai Bà Trưng', grade: 7, parentName: 'Chu Thị Yến', parentPhone: '0912444018', branch: branchHBT, createdBy: staffHBT2 },
            { name: 'Trịnh Bảo Châu', dob: '2008-01-27', gender: 'female', school: 'THCS Lê Ngọc Hân', grade: 9, parentName: 'Trịnh Văn Dũng', parentPhone: '0912444019', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'Lương Văn Kiên', dob: '2009-04-13', gender: 'male', school: 'THCS Nguyễn Du', grade: 8, parentName: 'Lương Thị Ngân', parentPhone: '0912444020', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'Đặng Thị Quỳnh', dob: '2010-06-29', gender: 'female', school: 'THCS Hai Bà Trưng', grade: 7, parentName: 'Đặng Văn Thọ', parentPhone: '0912444021', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'Phan Hữu Phúc', dob: '2008-08-16', gender: 'male', school: 'THCS Lê Ngọc Hân', grade: 9, parentName: 'Phan Thị Minh', parentPhone: '0912444022', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'Hồ Thị Kim Ngân', dob: '2009-10-24', gender: 'female', school: 'THCS Nguyễn Du', grade: 8, parentName: 'Hồ Văn Phong', parentPhone: '0912444023', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'Tạ Quang Huy', dob: '2010-12-11', gender: 'male', school: 'THCS Hai Bà Trưng', grade: 7, parentName: 'Tạ Thị Hồng', parentPhone: '0912444024', branch: branchHBT, createdBy: staffHBT1 },
            { name: 'La Thị Bảo Trân', dob: '2008-02-05', gender: 'female', school: 'THCS Lê Ngọc Hân', grade: 9, parentName: 'La Văn Chánh', parentPhone: '0912444025', branch: branchHBT, createdBy: staffHBT2 },
            { name: 'Từ Minh Quân', dob: '2009-04-22', gender: 'male', school: 'THCS Nguyễn Du', grade: 8, parentName: 'Từ Thị Thu', parentPhone: '0912444026', branch: branchHBT, createdBy: staffHBT2 },
            { name: 'Kiều Thị Diễm', dob: '2010-06-08', gender: 'female', school: 'THCS Hai Bà Trưng', grade: 7, parentName: 'Kiều Văn Tài', parentPhone: '0912444027', branch: branchHBT, createdBy: staffHBT2 },
            { name: 'Âu Văn Quốc', dob: '2008-08-25', gender: 'male', school: 'THCS Lê Ngọc Hân', grade: 9, parentName: 'Âu Thị Hoa', parentPhone: '0912444028', branch: branchHBT, createdBy: staffHBT2 },
            { name: 'Sầm Thị Ngọc Lan', dob: '2009-10-12', gender: 'female', school: 'THCS Nguyễn Du', grade: 8, parentName: 'Sầm Văn Khoa', parentPhone: '0912444029', branch: branchHBT, createdBy: staffHBT2 },
            { name: 'Nông Quang Vinh', dob: '2010-12-28', gender: 'male', school: 'THCS Hai Bà Trưng', grade: 7, parentName: 'Nông Thị Bảo', parentPhone: '0912444030', branch: branchHBT, createdBy: staffHBT2 },
            // CS Cầu Giấy — 30 HS
            { name: 'Lê Ngọc Diệp', dob: '2009-02-14', gender: 'female', school: 'THCS Cầu Giấy', grade: 8, parentName: 'Lê Văn Mạnh', parentPhone: '0912555001', branch: branchCG, createdBy: staffCG1 },
            { name: 'Trương Văn Đại', dob: '2008-04-30', gender: 'male', school: 'THCS Nghĩa Tân', grade: 9, parentName: 'Trương Thị Liên', parentPhone: '0912555002', branch: branchCG, createdBy: staffCG1 },
            { name: 'Ninh Thị Hải Yến', dob: '2010-07-16', gender: 'female', school: 'THCS Cầu Giấy', grade: 7, parentName: 'Ninh Văn Hào', parentPhone: '0912555003', branch: branchCG, createdBy: staffCG1 },
            { name: 'Ký Minh Đức', dob: '2009-09-03', gender: 'male', school: 'THCS Nghĩa Tân', grade: 8, parentName: 'Ký Thị Nhung', parentPhone: '0912555004', branch: branchCG, createdBy: staffCG1 },
            { name: 'Thái Thị Hồng Nhung', dob: '2008-11-21', gender: 'female', school: 'THCS Cầu Giấy', grade: 9, parentName: 'Thái Văn Hiếu', parentPhone: '0912555005', branch: branchCG, createdBy: staffCG1 },
            { name: 'Cù Đức Thịnh', dob: '2010-01-08', gender: 'male', school: 'THCS Nghĩa Tân', grade: 7, parentName: 'Cù Thị Bình', parentPhone: '0912555006', branch: branchCG, createdBy: staffCG1 },
            { name: 'Lục Thị Thanh Huyền', dob: '2009-03-26', gender: 'female', school: 'THCS Cầu Giấy', grade: 8, parentName: 'Lục Văn Tuấn', parentPhone: '0912555007', branch: branchCG, createdBy: staffCG2 },
            { name: 'Mạc Văn Toàn', dob: '2008-05-14', gender: 'male', school: 'THCS Nghĩa Tân', grade: 9, parentName: 'Mạc Thị Lý', parentPhone: '0912555008', branch: branchCG, createdBy: staffCG2 },
            { name: 'Liêu Thị Phụng', dob: '2010-07-31', gender: 'female', school: 'THCS Cầu Giấy', grade: 7, parentName: 'Liêu Văn An', parentPhone: '0912555009', branch: branchCG, createdBy: staffCG2 },
            { name: 'Ôn Văn Phú', dob: '2009-09-17', gender: 'male', school: 'THCS Nghĩa Tân', grade: 8, parentName: 'Ôn Thị Ngọc', parentPhone: '0912555010', branch: branchCG, createdBy: staffCG2 },
            { name: 'Đàm Thị Bích Ngọc', dob: '2008-11-04', gender: 'female', school: 'THCS Cầu Giấy', grade: 9, parentName: 'Đàm Văn Lực', parentPhone: '0912555011', branch: branchCG, createdBy: staffCG2 },
            { name: 'Triệu Văn Hưng', dob: '2010-01-22', gender: 'male', school: 'THCS Nghĩa Tân', grade: 7, parentName: 'Triệu Thị Mai', parentPhone: '0912555012', branch: branchCG, createdBy: staffCG2 },
            { name: 'Mã Thị Thúy Hằng', dob: '2009-04-09', gender: 'female', school: 'THCS Cầu Giấy', grade: 8, parentName: 'Mã Văn Vinh', parentPhone: '0912555013', branch: branchCG, createdBy: staffCG1 },
            { name: 'Doãn Quốc Huy', dob: '2008-06-27', gender: 'male', school: 'THCS Nghĩa Tân', grade: 9, parentName: 'Doãn Thị Tuyết', parentPhone: '0912555014', branch: branchCG, createdBy: staffCG1 },
            { name: 'Lăng Thị Diệu', dob: '2010-08-13', gender: 'female', school: 'THCS Cầu Giấy', grade: 7, parentName: 'Lăng Văn Dần', parentPhone: '0912555015', branch: branchCG, createdBy: staffCG1 },
            { name: 'Bạch Văn Tú', dob: '2009-10-30', gender: 'male', school: 'THCS Nghĩa Tân', grade: 8, parentName: 'Bạch Thị Hoa', parentPhone: '0912555016', branch: branchCG, createdBy: staffCG1 },
            { name: 'Ung Thị Ngọc Huyền', dob: '2008-12-18', gender: 'female', school: 'THCS Cầu Giấy', grade: 9, parentName: 'Ung Văn Cảnh', parentPhone: '0912555017', branch: branchCG, createdBy: staffCG2 },
            { name: 'Hứa Minh Luân', dob: '2010-02-05', gender: 'male', school: 'THCS Nghĩa Tân', grade: 7, parentName: 'Hứa Thị Linh', parentPhone: '0912555018', branch: branchCG, createdBy: staffCG2 },
            { name: 'Châu Thị Thanh Thảo', dob: '2009-04-23', gender: 'female', school: 'THCS Cầu Giấy', grade: 8, parentName: 'Châu Văn Minh', parentPhone: '0912555019', branch: branchCG, createdBy: staffCG2 },
            { name: 'Dư Văn Nghĩa', dob: '2008-07-10', gender: 'male', school: 'THCS Nghĩa Tân', grade: 9, parentName: 'Dư Thị Lan', parentPhone: '0912555020', branch: branchCG, createdBy: staffCG2 },
            { name: 'Tưởng Thị Cẩm Ly', dob: '2010-09-28', gender: 'female', school: 'THCS Cầu Giấy', grade: 7, parentName: 'Tưởng Văn Khánh', parentPhone: '0912555021', branch: branchCG, createdBy: staffCG2 },
            { name: 'Phó Văn Khương', dob: '2009-11-14', gender: 'male', school: 'THCS Nghĩa Tân', grade: 8, parentName: 'Phó Thị Hà', parentPhone: '0912555022', branch: branchCG, createdBy: staffCG2 },
            { name: 'Nhan Thị Kim Chi', dob: '2008-01-02', gender: 'female', school: 'THCS Cầu Giấy', grade: 9, parentName: 'Nhan Văn Dũng', parentPhone: '0912555023', branch: branchCG, createdBy: staffCG1 },
            { name: 'Tào Minh Khải', dob: '2010-03-20', gender: 'male', school: 'THCS Nghĩa Tân', grade: 7, parentName: 'Tào Thị Hương', parentPhone: '0912555024', branch: branchCG, createdBy: staffCG1 },
            { name: 'Khổng Thị Diệu Linh', dob: '2009-06-07', gender: 'female', school: 'THCS Cầu Giấy', grade: 8, parentName: 'Khổng Văn Bảo', parentPhone: '0912555025', branch: branchCG, createdBy: staffCG1 },
            { name: 'Tiết Văn Quang', dob: '2008-08-24', gender: 'male', school: 'THCS Nghĩa Tân', grade: 9, parentName: 'Tiết Thị Yên', parentPhone: '0912555026', branch: branchCG, createdBy: staffCG1 },
            { name: 'Tôn Thị Ngọc Ánh', dob: '2010-10-11', gender: 'female', school: 'THCS Cầu Giấy', grade: 7, parentName: 'Tôn Văn Hải', parentPhone: '0912555027', branch: branchCG, createdBy: staffCG2 },
            { name: 'Quản Văn Phong', dob: '2009-12-29', gender: 'male', school: 'THCS Nghĩa Tân', grade: 8, parentName: 'Quản Thị Nhàn', parentPhone: '0912555028', branch: branchCG, createdBy: staffCG2 },
            { name: 'Giản Thị Mỹ Linh', dob: '2008-02-16', gender: 'female', school: 'THCS Cầu Giấy', grade: 9, parentName: 'Giản Văn Toàn', parentPhone: '0912555029', branch: branchCG, createdBy: staffCG2 },
            { name: 'Nghiêm Quang Trung', dob: '2010-04-04', gender: 'male', school: 'THCS Nghĩa Tân', grade: 7, parentName: 'Nghiêm Thị Hiền', parentPhone: '0912555030', branch: branchCG, createdBy: staffCG2 },
        ];
        const studentIds = studentRaw.map(() => new Types.ObjectId());
        const parentIds = studentRaw.map(() => new Types.ObjectId());
        // Insert students
        await User.insertMany(studentRaw.map((s, i) => ({
            _id: studentIds[i],
            schemaVersion: 1,
            userCode: `HS-2025-${String(i + 1).padStart(4, '0')}`,
            email: `hs${String(i + 1).padStart(3, '0')}@student.lcms.edu.vn`,
            phone: null,
            passwordHash,
            role: ROLES.STUDENT,
            branchId: s.branch,
            fullName: s.name,
            dateOfBirth: new Date(s.dob),
            gender: s.gender,
            avatarUrl: null,
            studentInfo: {
                activeClassIds: [], // cập nhật sau khi tạo enrollments
                enrollmentDate: daysAgo(randInt(30, 120)),
                parentIds: [parentIds[i]],
                schoolName: s.school,
                grade: s.grade,
            },
            isActive: true,
            lastLoginAt: daysAgo(randInt(0, 7)),
            createdAt: daysAgo(randInt(30, 120)),
            updatedAt: daysAgo(1),
            createdBy: s.createdBy,
            deletedAt: null,
            deletedBy: null,
        })));
        // Insert parents
        await User.insertMany(studentRaw.map((s, i) => ({
            _id: parentIds[i],
            schemaVersion: 1,
            userCode: `PH-2025-${String(i + 1).padStart(4, '0')}`,
            email: `ph${String(i + 1).padStart(3, '0')}@parent.lcms.edu.vn`,
            phone: s.parentPhone,
            passwordHash,
            role: ROLES.PARENT,
            branchId: s.branch,
            fullName: s.parentName,
            dateOfBirth: null,
            gender: 'other',
            avatarUrl: null,
            parentInfo: {
                studentIds: [studentIds[i]],
                relationship: randItem(['father', 'mother', 'guardian']),
            },
            isActive: true,
            lastLoginAt: daysAgo(randInt(0, 14)),
            createdAt: daysAgo(randInt(30, 120)),
            updatedAt: daysAgo(1),
            createdBy: s.createdBy,
            deletedAt: null,
            deletedBy: null,
        })));
        console.log(`✅ Students: 60 | Parents: 60`);
        // ════════════════════════════════════════════════════════
        // 8. ENROLLMENTS — xếp HS vào lớp (multi-class)
        // ════════════════════════════════════════════════════════
        // Mỗi HS có thể học 1-3 lớp cùng lúc
        // HBT: index 0-29 | CG: index 30-59
        const enrollmentPlan = [
            { classId: cls.toan8a, studentIdxs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
            { classId: cls.toan9a, studentIdxs: [12, 13, 14, 15, 16, 17, 18, 19] },
            { classId: cls.anh7a, studentIdxs: [0, 2, 4, 6, 8, 20, 21, 22, 23, 24] }, // 0,2,4,6,8 học 2 lớp
            { classId: cls.anh8b, studentIdxs: [1, 3, 5, 7, 9, 25, 26, 27, 28, 29] },
            { classId: cls.van8a, studentIdxs: [10, 11, 12, 13, 20, 21, 22, 23, 24, 25] },
            { classId: cls.ly9a, studentIdxs: [30, 31, 32, 33, 34, 35, 36, 37, 38, 39] },
            { classId: cls.hoa9b, studentIdxs: [32, 33, 34, 40, 41, 42, 43, 44, 45] }, // 32,33,34 học 2 lớp
            { classId: cls.toanCG, studentIdxs: [30, 31, 46, 47, 48, 49, 50, 51, 52, 53] },
            { classId: cls.anhCG, studentIdxs: [35, 36, 37, 38, 54, 55, 56, 57, 58, 59] },
            { classId: cls.vanCG, studentIdxs: [39, 40, 41, 42, 43, 54, 55, 56] },
        ];
        const enrollmentDocs = [];
        for (const plan of enrollmentPlan) {
            const clsDoc = classDefs.find(c => c._id.equals(plan.classId));
            for (const idx of plan.studentIdxs) {
                enrollmentDocs.push({
                    schemaVersion: 1,
                    branchId: clsDoc.branchId,
                    studentId: studentIds[idx],
                    classId: plan.classId,
                    classSnapshot: {
                        name: clsDoc.name,
                        subjectName: clsDoc.subject.name,
                        teacherName: clsDoc.teacherSnapshot.fullName,
                    },
                    enrolledAt: daysAgo(randInt(30, 80)),
                    leftAt: null,
                    leftReason: null,
                    enrolledBy: clsDoc.branchId.equals(branchHBT) ? staffHBT1 : staffCG1,
                    createdAt: daysAgo(randInt(30, 80)),
                    updatedAt: daysAgo(1),
                });
            }
        }
        await Enrollment.insertMany(enrollmentDocs);
        // Cập nhật student_count và activeClassIds
        for (const plan of enrollmentPlan) {
            await Class.updateOne({ _id: plan.classId }, { $set: { studentCount: plan.studentIdxs.length } });
            for (const idx of plan.studentIdxs) {
                await User.updateOne({ _id: studentIds[idx] }, { $addToSet: { 'studentInfo.activeClassIds': plan.classId } });
            }
        }
        console.log(`✅ Enrollments: ${enrollmentDocs.length} | Student activeClassIds: cập nhật xong`);
        // ════════════════════════════════════════════════════════
        // 9. CLASS SESSIONS — 60 ngày qua
        // ════════════════════════════════════════════════════════
        const sessionDocs = [];
        for (const clsDef of classDefs) {
            for (let d = 60; d >= 0; d--) {
                const date = daysAgo(d);
                const dow = date.getDay();
                for (const slot of clsDef.weeklySchedule) {
                    if (slot.dayOfWeek === dow) {
                        const isPast = d > 0;
                        sessionDocs.push({
                            schemaVersion: 1,
                            branchId: clsDef.branchId,
                            classId: clsDef._id,
                            teacherId: clsDef.teacherId,
                            sessionDate: new Date(date.toDateString()),
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                            roomCode: slot.roomCode,
                            sessionType: 'regular',
                            status: isPast ? 'completed' : 'scheduled',
                            note: '',
                            attendanceStatus: isPast ? 'submitted' : 'pending',
                            materials: [],
                            onlineMeetingUrl: null,
                            createdAt: daysAgo(d + 1),
                            updatedAt: daysAgo(Math.max(d, 1)),
                            deletedAt: null,
                        });
                    }
                }
            }
        }
        await ClassSession.insertMany(sessionDocs);
        console.log(`✅ ClassSessions: ${sessionDocs.length}`);
        // ════════════════════════════════════════════════════════
        // 10. ATTENDANCES
        // ════════════════════════════════════════════════════════
        const completedSessions = await ClassSession.find({ status: 'completed' }).lean();
        const attendanceDocs = [];
        for (const session of completedSessions) {
            const plan = enrollmentPlan.find(p => p.classId.equals(session.classId));
            if (!plan)
                continue;
            for (const idx of plan.studentIdxs) {
                const isPresent = Math.random() > 0.10; // 90% có mặt
                attendanceDocs.push({
                    schemaVersion: 1,
                    branchId: session.branchId,
                    sessionId: session._id,
                    classId: session.classId,
                    studentId: studentIds[idx],
                    teacherId: session.teacherId,
                    status: isPresent ? 'present' : 'absent',
                    sessionDate: session.sessionDate,
                    markedAt: addDays(session.sessionDate, 0),
                    absenceNotified: !isPresent,
                    editHistory: [],
                    createdAt: session.sessionDate,
                    updatedAt: session.sessionDate,
                });
            }
        }
        await Attendance.insertMany(attendanceDocs);
        console.log(`✅ Attendances: ${attendanceDocs.length}`);
        // ════════════════════════════════════════════════════════
        // 11. ASSIGNMENTS — 10 bài tập mẫu
        // ════════════════════════════════════════════════════════
        const assignmentDefs = [
            { classId: cls.toan8a, teacherId: tc.hungHBT, branchId: branchHBT, title: 'Bài tập Số học — Chương 1', dueAgo: 25 },
            { classId: cls.toan8a, teacherId: tc.hungHBT, branchId: branchHBT, title: 'Bài tập Phương trình bậc nhất', dueAgo: 10 },
            { classId: cls.toan9a, teacherId: tc.maiHBT, branchId: branchHBT, title: 'Luyện đề Toán — Phần đại số', dueAgo: 20 },
            { classId: cls.anh7a, teacherId: tc.chauHBT, branchId: branchHBT, title: 'Vocabulary Exercise — Unit 1 & 2', dueAgo: 15 },
            { classId: cls.anh7a, teacherId: tc.chauHBT, branchId: branchHBT, title: 'Grammar Worksheet — Present Tenses', dueAgo: 5 },
            { classId: cls.van8a, teacherId: tc.baoHBT, branchId: branchHBT, title: 'Phân tích nhân vật trong Lão Hạc', dueAgo: 18 },
            { classId: cls.ly9a, teacherId: tc.thanhCG, branchId: branchCG, title: 'Bài tập Cơ học — Định luật Newton', dueAgo: 12 },
            { classId: cls.hoa9b, teacherId: tc.longCG, branchId: branchCG, title: 'Bài tập Nguyên tử và Phân tử', dueAgo: 8 },
            { classId: cls.toanCG, teacherId: tc.longCG, branchId: branchCG, title: 'Ôn tập Toán — Hàm số bậc nhất', dueAgo: 14 },
            { classId: cls.anhCG, teacherId: tc.huongCG, branchId: branchCG, title: 'Practice Test — Reading & Writing', dueAgo: 6 },
        ];
        const assignmentIds = assignmentDefs.map(() => new Types.ObjectId());
        await Assignment.insertMany(assignmentDefs.map((a, i) => ({
            _id: assignmentIds[i],
            schemaVersion: 1,
            branchId: a.branchId,
            classId: a.classId,
            teacherId: a.teacherId,
            sessionId: null,
            title: a.title,
            description: '<p>Học sinh hoàn thành và nộp trước hạn. Trình bày rõ ràng, đầy đủ các bước.</p>',
            attachmentUrls: [],
            assignmentType: 'homework',
            dueDate: daysAgo(a.dueAgo),
            maxScore: 10,
            isGraded: true,
            visibleToParent: true,
            submissionConfig: { allowText: true, allowFile: true, maxFileSizeMb: 10, allowedExtensions: ['pdf', 'doc', 'docx', 'jpg', 'png'] },
            status: 'closed',
            submissionCount: 0,
            gradedCount: 0,
            createdAt: daysAgo(a.dueAgo + 7),
            updatedAt: daysAgo(1),
            deletedAt: null,
        })));
        console.log(`✅ Assignments: ${assignmentDefs.length}`);
        // ════════════════════════════════════════════════════════
        // 12. SUBMISSIONS — ~80% HS nộp bài
        // ════════════════════════════════════════════════════════
        const submissionDocs = [];
        for (let i = 0; i < assignmentDefs.length; i++) {
            const a = assignmentDefs[i];
            const plan = enrollmentPlan.find(p => p.classId.equals(a.classId));
            if (!plan)
                continue;
            let subCount = 0, gradedCount = 0;
            for (const idx of plan.studentIdxs) {
                if (Math.random() > 0.20) {
                    const isLate = Math.random() > 0.85;
                    const score = parseFloat((Math.random() * 4 + 6).toFixed(1));
                    const dueDate = daysAgo(a.dueAgo);
                    submissionDocs.push({
                        schemaVersion: 1,
                        branchId: a.branchId,
                        assignmentId: assignmentIds[i],
                        studentId: studentIds[idx],
                        classId: a.classId,
                        contentText: '<p>Bài làm của em. Em xin nộp theo yêu cầu của thầy/cô.</p>',
                        attachmentUrls: [],
                        submittedAt: isLate ? addDays(dueDate, 1) : daysAgo(a.dueAgo + randInt(1, 3)),
                        isLate,
                        resubmitCount: 0,
                        status: 'graded',
                        score,
                        maxScore: 10,
                        feedback: randItem(['Bài làm tốt!', 'Cần xem lại phần tính toán.', 'Xuất sắc!', 'Thiếu một số bước trình bày.']),
                        gradedAt: daysAgo(randInt(1, 5)),
                        gradedBy: a.teacherId,
                        revisionRequested: false,
                        revisionNote: null,
                        createdAt: daysAgo(a.dueAgo + randInt(1, 3)),
                        updatedAt: daysAgo(1),
                    });
                    subCount++;
                    gradedCount++;
                }
            }
            await Assignment.updateOne({ _id: assignmentIds[i] }, { $set: { submissionCount: subCount, gradedCount } });
        }
        await Submission.insertMany(submissionDocs);
        console.log(`✅ Submissions: ${submissionDocs.length}`);
        // ════════════════════════════════════════════════════════
        // 13. QUESTION BANK — 15 câu hỏi mẫu
        // ════════════════════════════════════════════════════════
        await QuestionBank.insertMany([
            { schemaVersion: 1, createdBy: tc.hungHBT, subjectName: 'Toán học', subjectCode: 'TOAN', questionType: 'multiple_choice', difficulty: 'easy', content: 'Kết quả của 15 × 8 − 40 ÷ 5 là bao nhiêu?', options: [{ key: 'A', content: '112' }, { key: 'B', content: '96' }, { key: 'C', content: '108' }, { key: 'D', content: '100' }], correctAnswer: 'A', chapter: 'Chương 1', tags: ['số học'], isReported: false, reportNote: null, isActive: true, usageCount: 0, createdAt: daysAgo(30), updatedAt: daysAgo(30), deletedAt: null },
            { schemaVersion: 1, createdBy: tc.hungHBT, subjectName: 'Toán học', subjectCode: 'TOAN', questionType: 'multiple_choice', difficulty: 'medium', content: 'Giải phương trình 3x − 7 = 2x + 5, tìm x:', options: [{ key: 'A', content: 'x=10' }, { key: 'B', content: 'x=12' }, { key: 'C', content: 'x=8' }, { key: 'D', content: 'x=14' }], correctAnswer: 'B', chapter: 'Chương 2', tags: ['phương trình'], isReported: false, reportNote: null, isActive: true, usageCount: 0, createdAt: daysAgo(30), updatedAt: daysAgo(30), deletedAt: null },
            { schemaVersion: 1, createdBy: tc.hungHBT, subjectName: 'Toán học', subjectCode: 'TOAN', questionType: 'true_false', difficulty: 'easy', content: 'Tam giác có các cạnh 3cm, 4cm, 5cm là tam giác vuông.', correctAnswer: true, chapter: 'Chương 3', tags: ['hình học'], isReported: false, reportNote: null, isActive: true, usageCount: 0, createdAt: daysAgo(30), updatedAt: daysAgo(30), deletedAt: null },
            { schemaVersion: 1, createdBy: tc.hungHBT, subjectName: 'Toán học', subjectCode: 'TOAN', questionType: 'fill_blank', difficulty: 'medium', content: 'Diện tích hình thang đáy lớn 12cm, đáy nhỏ 8cm, chiều cao 5cm là ___ cm².', correctAnswer: '50', answerTolerance: 'exact', chapter: 'Chương 3', tags: ['hình học'], isReported: false, reportNote: null, isActive: true, usageCount: 0, createdAt: daysAgo(30), updatedAt: daysAgo(30), deletedAt: null },
            { schemaVersion: 1, createdBy: tc.hungHBT, subjectName: 'Toán học', subjectCode: 'TOAN', questionType: 'essay', difficulty: 'hard', content: 'Chứng minh rằng với mọi n tự nhiên, tổng n³ + 2n chia hết cho 3.', correctAnswer: null, gradingGuide: 'Dùng quy nạp hoặc chia trường hợp n mod 3.', chapter: 'Chương 4', tags: ['chứng minh'], isReported: false, reportNote: null, isActive: true, usageCount: 0, createdAt: daysAgo(30), updatedAt: daysAgo(30), deletedAt: null },
            { schemaVersion: 1, createdBy: tc.chauHBT, subjectName: 'Tiếng Anh', subjectCode: 'ANH', questionType: 'multiple_choice', difficulty: 'easy', content: "Choose the correct form: 'She ___ to school every day.'", options: [{ key: 'A', content: 'go' }, { key: 'B', content: 'goes' }, { key: 'C', content: 'going' }, { key: 'D', content: 'gone' }], correctAnswer: 'B', chapter: 'Unit 1', tags: ['grammar', 'present simple'], isReported: false, reportNote: null, isActive: true, usageCount: 0, createdAt: daysAgo(25), updatedAt: daysAgo(25), deletedAt: null },
            { schemaVersion: 1, createdBy: tc.chauHBT, subjectName: 'Tiếng Anh', subjectCode: 'ANH', questionType: 'multiple_choice', difficulty: 'medium', content: "If I ___ rich, I would travel the world.", options: [{ key: 'A', content: 'am' }, { key: 'B', content: 'was' }, { key: 'C', content: 'were' }, { key: 'D', content: 'be' }], correctAnswer: 'C', chapter: 'Unit 5', tags: ['conditional'], isReported: false, reportNote: null, isActive: true, usageCount: 0, createdAt: daysAgo(25), updatedAt: daysAgo(25), deletedAt: null },
            { schemaVersion: 1, createdBy: tc.chauHBT, subjectName: 'Tiếng Anh', subjectCode: 'ANH', questionType: 'fill_blank', difficulty: 'easy', content: "The opposite of 'beautiful' is ___.", correctAnswer: 'ugly', answerTolerance: 'case_insensitive', chapter: 'Unit 2', tags: ['vocabulary'], isReported: false, reportNote: null, isActive: true, usageCount: 0, createdAt: daysAgo(25), updatedAt: daysAgo(25), deletedAt: null },
            { schemaVersion: 1, createdBy: tc.chauHBT, subjectName: 'Tiếng Anh', subjectCode: 'ANH', questionType: 'true_false', difficulty: 'medium', content: "'I have been waiting for two hours' is correct Present Perfect Continuous.", correctAnswer: true, chapter: 'Unit 4', tags: ['grammar'], isReported: false, reportNote: null, isActive: true, usageCount: 0, createdAt: daysAgo(25), updatedAt: daysAgo(25), deletedAt: null },
            { schemaVersion: 1, createdBy: tc.chauHBT, subjectName: 'Tiếng Anh', subjectCode: 'ANH', questionType: 'essay', difficulty: 'hard', content: 'Write a paragraph (80-100 words) about the advantages of learning English.', correctAnswer: null, gradingGuide: 'Nội dung (4đ), ngữ pháp (3đ), từ vựng (3đ).', chapter: 'Unit 6', tags: ['writing'], isReported: false, reportNote: null, isActive: true, usageCount: 0, createdAt: daysAgo(25), updatedAt: daysAgo(25), deletedAt: null },
            { schemaVersion: 1, createdBy: tc.thanhCG, subjectName: 'Vật Lý', subjectCode: 'LY', questionType: 'multiple_choice', difficulty: 'easy', content: 'Đơn vị đo lực trong hệ SI là gì?', options: [{ key: 'A', content: 'Kilogram' }, { key: 'B', content: 'Newton' }, { key: 'C', content: 'Joule' }, { key: 'D', content: 'Watt' }], correctAnswer: 'B', chapter: 'Chương 1', tags: ['cơ học', 'đơn vị'], isReported: false, reportNote: null, isActive: true, usageCount: 0, createdAt: daysAgo(20), updatedAt: daysAgo(20), deletedAt: null },
            { schemaVersion: 1, createdBy: tc.thanhCG, subjectName: 'Vật Lý', subjectCode: 'LY', questionType: 'multiple_choice', difficulty: 'medium', content: 'Vật 2kg chịu lực 10N. Gia tốc của vật là bao nhiêu?', options: [{ key: 'A', content: '2 m/s²' }, { key: 'B', content: '5 m/s²' }, { key: 'C', content: '20 m/s²' }, { key: 'D', content: '0,2 m/s²' }], correctAnswer: 'B', chapter: 'Chương 1', tags: ['Newton', 'gia tốc'], isReported: false, reportNote: null, isActive: true, usageCount: 0, createdAt: daysAgo(20), updatedAt: daysAgo(20), deletedAt: null },
            { schemaVersion: 1, createdBy: tc.thanhCG, subjectName: 'Vật Lý', subjectCode: 'LY', questionType: 'true_false', difficulty: 'easy', content: 'Ánh sáng truyền trong chân không với vận tốc khoảng 3×10⁸ m/s.', correctAnswer: true, chapter: 'Chương 4', tags: ['quang học'], isReported: false, reportNote: null, isActive: true, usageCount: 0, createdAt: daysAgo(20), updatedAt: daysAgo(20), deletedAt: null },
            { schemaVersion: 1, createdBy: tc.thanhCG, subjectName: 'Vật Lý', subjectCode: 'LY', questionType: 'fill_blank', difficulty: 'medium', content: 'Công thức tính công cơ học là A = F × ___.', correctAnswer: 's', answerTolerance: 'exact', chapter: 'Chương 2', tags: ['công cơ học'], isReported: false, reportNote: null, isActive: true, usageCount: 0, createdAt: daysAgo(20), updatedAt: daysAgo(20), deletedAt: null },
            { schemaVersion: 1, createdBy: tc.thanhCG, subjectName: 'Vật Lý', subjectCode: 'LY', questionType: 'essay', difficulty: 'hard', content: 'Quả bóng rơi tự do từ độ cao 20m. Tính vận tốc ngay trước khi chạm đất (g = 10 m/s²).', correctAnswer: null, gradingGuide: 'v² = 2gh = 400 → v = 20 m/s. Ghi rõ công thức, thay số, đơn vị.', chapter: 'Chương 1', tags: ['rơi tự do'], isReported: false, reportNote: null, isActive: true, usageCount: 0, createdAt: daysAgo(20), updatedAt: daysAgo(20), deletedAt: null },
        ]);
        console.log('✅ QuestionBank: 15');
        // ════════════════════════════════════════════════════════
        // 14. INVOICES + PAYMENTS — 2 tháng
        // ════════════════════════════════════════════════════════
        const invoiceDocs = [];
        const paymentDocs = [];
        const invoiceIds = [];
        for (const period of ['2025-04', '2025-05']) {
            const [yr, mo] = period.split('-').map(Number);
            const periodStart = new Date(`${yr}-${String(mo).padStart(2, '0')}-01`);
            const periodEnd = mo === 12
                ? new Date(`${yr + 1}-01-01`)
                : new Date(`${yr}-${String(mo + 1).padStart(2, '0')}-01`);
            const dueDate = new Date(`${yr}-${String(mo).padStart(2, '0')}-${mo === 4 ? '30' : '31'}`);
            for (const plan of enrollmentPlan) {
                const clsDef = classDefs.find(c => c._id.equals(plan.classId));
                if (!clsDef.ongoingInfo)
                    continue; // bỏ qua lớp theo khóa
                for (const idx of plan.studentIdxs) {
                    // Đếm số buổi có mặt trong tháng từ attendanceDocs
                    const sessionsAttended = attendanceDocs.filter((a) => a.studentId.equals(studentIds[idx]) &&
                        a.classId.equals(plan.classId) &&
                        a.status === 'present' &&
                        a.sessionDate >= periodStart &&
                        a.sessionDate < periodEnd).length;
                    if (sessionsAttended === 0)
                        continue;
                    const feePerSession = clsDef.ongoingInfo.feePerSession;
                    const subtotal = sessionsAttended * feePerSession;
                    const discount = Math.random() > 0.9 ? 50000 : 0;
                    const totalAmount = subtotal - discount;
                    const isPaid = period === '2025-04' || Math.random() > 0.25;
                    const isOverdue = !isPaid && dueDate < new Date();
                    const paidAt = isPaid ? daysAgo(randInt(1, 20)) : null;
                    const method = isPaid ? randItem(['cash', 'vnpay']) : null;
                    const invId = new Types.ObjectId();
                    invoiceIds.push(invId);
                    const stu = studentRaw[idx];
                    invoiceDocs.push({
                        _id: invId,
                        schemaVersion: 1,
                        branchId: clsDef.branchId,
                        studentId: studentIds[idx],
                        classId: plan.classId,
                        studentSnapshot: { fullName: stu.name, userCode: `HS-2025-${String(idx + 1).padStart(4, '0')}` },
                        classSnapshot: { name: clsDef.name, subjectName: clsDef.subject.name },
                        invoiceCode: `INV-${period}-${String(invoiceDocs.length + 1).padStart(4, '0')}`,
                        invoiceType: 'monthly',
                        billingPeriod: period,
                        sessionsAttended,
                        sessionsTotal: sessionsAttended + randInt(0, 2),
                        feePerSession,
                        courseFee: null,
                        subtotal,
                        discountAmount: discount,
                        discountNote: discount > 0 ? 'Ưu đãi học sinh cũ' : null,
                        excusedSessions: 0,
                        totalAmount,
                        dueDate,
                        status: isPaid ? 'paid' : (isOverdue ? 'overdue' : 'unpaid'),
                        paymentMethod: method,
                        paidAt,
                        paidAmount: isPaid ? totalAmount : null,
                        confirmedBy: isPaid && method === 'cash'
                            ? (clsDef.branchId.equals(branchHBT) ? staffHBT1 : staffCG1)
                            : null,
                        paymentIds: [],
                        vnpayTransactionRef: null,
                        vnpayTransactionId: null,
                        generationType: 'auto',
                        createdBy: clsDef.branchId.equals(branchHBT) ? staffHBT1 : staffCG1,
                        note: '',
                        createdAt: daysAgo(35),
                        updatedAt: daysAgo(1),
                        deletedAt: null,
                    });
                    if (isPaid) {
                        const pmId = new Types.ObjectId();
                        const vnpayRef = method === 'vnpay' ? `VNP${Date.now()}${randInt(1000, 9999)}` : null;
                        paymentDocs.push({
                            _id: pmId,
                            schemaVersion: 1,
                            branchId: clsDef.branchId,
                            invoiceId: invId,
                            studentId: studentIds[idx],
                            paymentMethod: method,
                            amount: totalAmount,
                            status: 'success',
                            receivedBy: method === 'cash'
                                ? (clsDef.branchId.equals(branchHBT) ? staffHBT1 : staffCG1)
                                : null,
                            receivedAt: method === 'cash' ? paidAt : null,
                            vnpayRef,
                            vnpayData: method === 'vnpay' ? { responseCode: '00', bankCode: randItem(['VIETCOMBANK', 'TECHCOMBANK', 'MB']) } : null,
                            createdAt: paidAt,
                        });
                        // Gắn paymentId và vnpayRef vào invoice
                        const inv = invoiceDocs[invoiceDocs.length - 1];
                        inv.paymentIds = [pmId];
                        inv.vnpayTransactionRef = vnpayRef;
                    }
                }
            }
        }
        await Invoice.insertMany(invoiceDocs);
        await Payment.insertMany(paymentDocs);
        console.log(`✅ Invoices: ${invoiceDocs.length} | Payments: ${paymentDocs.length}`);
        // ════════════════════════════════════════════════════════
        // 15. NOTIFICATIONS — thông báo vắng học + học phí
        // ════════════════════════════════════════════════════════
        const notifDocs = [];
        // Vắng học → gửi cho phụ huynh
        const absentList = attendanceDocs.filter((a) => a.status === 'absent').slice(0, 60);
        for (const rec of absentList) {
            const idx = studentIds.findIndex(id => id.equals(rec.studentId));
            if (idx < 0)
                continue;
            const clsDef = classDefs.find(c => c._id.equals(rec.classId));
            const dateFmt = rec.sessionDate.toLocaleDateString('vi-VN');
            notifDocs.push({
                schemaVersion: 1,
                branchId: rec.branchId,
                recipientId: parentIds[idx],
                type: 'absence',
                title: 'Con bạn vắng học hôm nay',
                content: `Học sinh ${studentRaw[idx].name} vắng buổi học ${clsDef?.name} ngày ${dateFmt}.`,
                actionUrl: '/parent/children',
                channels: ['in_app', 'email'],
                metadata: { studentId: studentIds[idx].toString(), className: clsDef?.name },
                isRead: Math.random() > 0.4,
                readAt: null,
                emailSent: true,
                emailSentAt: rec.sessionDate,
                createdAt: rec.sessionDate,
                expiresAt: addDays(rec.sessionDate, 180),
            });
        }
        // Học phí quá hạn / chưa thanh toán
        const unpaidInvoices = invoiceDocs.filter((inv) => ['unpaid', 'overdue'].includes(inv.status)).slice(0, 40);
        for (const inv of unpaidInvoices) {
            const idx = studentIds.findIndex(id => id.equals(inv.studentId));
            if (idx < 0)
                continue;
            notifDocs.push({
                schemaVersion: 1,
                branchId: inv.branchId,
                recipientId: parentIds[idx],
                type: 'invoice_due',
                title: inv.status === 'overdue' ? '⚠️ Học phí quá hạn' : `Nhắc nhở: Học phí ${inv.billingPeriod}`,
                content: `Phiếu ${inv.invoiceCode} số tiền ${inv.totalAmount.toLocaleString('vi-VN')}đ ${inv.status === 'overdue' ? 'đã quá hạn.' : 'sắp đến hạn.'}`,
                actionUrl: `/parent/invoices/${inv._id}`,
                channels: ['in_app', 'email'],
                metadata: { invoiceId: inv._id.toString(), amount: inv.totalAmount },
                isRead: Math.random() > 0.5,
                readAt: null,
                emailSent: true,
                emailSentAt: daysAgo(randInt(1, 5)),
                createdAt: daysAgo(randInt(1, 7)),
                expiresAt: daysFromNow(180),
            });
        }
        // await Notification.insertMany(notifDocs);
        console.log(`✅ Notifications: ${notifDocs.length}`);
        // ════════════════════════════════════════════════════════
        // 16. MESSAGES — 20 tin nhắn GV ↔ PH
        // ════════════════════════════════════════════════════════
        const messageSamples = [
            'Thưa thầy/cô, con tôi hôm nay bị ốm không đi học được ạ.',
            'Cảm ơn phụ huynh đã thông báo. Em có thể học bù vào buổi tới.',
            'Thầy ơi, con tôi thấy bài tập khó quá, không hiểu phần phương trình.',
            'Phụ huynh cho biết em đang học trang bài nào để thầy hỗ trợ thêm nhé.',
            'Hôm nay em học rất tốt, đã hiểu bài và làm được bài tập trong lớp.',
            'Tuần tới sẽ có bài kiểm tra 15 phút, nhắc em ôn lại chương 2 nhé.',
            'Cảm ơn thầy đã thông báo, tôi sẽ nhắc cháu ôn bài ngay.',
            'Con tôi nói không khí lớp học rất vui và thân thiện ạ.',
        ];
        const messageDocs = [];
        const teacherList = [tc.hungHBT, tc.maiHBT, tc.chauHBT, tc.baoHBT, tc.huongCG, tc.longCG, tc.thanhCG, tc.truongCG];
        for (let i = 0; i < 20; i++) {
            const tid = randItem(teacherList);
            const pidIdx = randInt(0, 59);
            const pid = parentIds[pidIdx];
            const ids = [tid.toString(), pid.toString()].sort();
            const threadId = ids.join('_');
            const isTeacher = Math.random() > 0.5;
            const branchId = studentRaw[pidIdx].branch;
            messageDocs.push({
                schemaVersion: 1,
                branchId,
                threadId,
                senderId: isTeacher ? tid : pid,
                receiverId: isTeacher ? pid : tid,
                messageType: 'text',
                content: randItem(messageSamples),
                attachmentUrl: null,
                isRead: Math.random() > 0.3,
                readAt: null,
                sentAt: daysAgo(randInt(0, 20)),
                deletedAt: null,
            });
        }
        await Message.insertMany(messageDocs);
        console.log(`✅ Messages: ${messageDocs.length}`);
        // ════════════════════════════════════════════════════════
        // 17. CLASS ANNOUNCEMENTS
        // ════════════════════════════════════════════════════════
        await ClassAnnouncement.insertMany([
            { schemaVersion: 1, branchId: branchHBT, classId: cls.toan8a, authorId: tc.hungHBT, title: 'Lịch kiểm tra giữa kỳ', content: '<p>Lớp sẽ có bài kiểm tra 45 phút vào tuần tới. Ôn tập từ chương 1 đến chương 3.</p>', attachmentUrls: [], targetAudience: ['student', 'parent'], isPinned: true, notificationSent: true, notificationSentAt: daysAgo(10), createdAt: daysAgo(10), updatedAt: daysAgo(10), deletedAt: null },
            { schemaVersion: 1, branchId: branchHBT, classId: cls.anh7a, authorId: tc.chauHBT, title: 'Vocabulary List — Unit 3', content: '<p>Học thuộc 30 từ Unit 3 trước buổi thứ Hai. Sẽ có kiểm tra miệng đầu giờ.</p>', attachmentUrls: [], targetAudience: ['student'], isPinned: false, notificationSent: true, notificationSentAt: daysAgo(3), createdAt: daysAgo(3), updatedAt: daysAgo(3), deletedAt: null },
            { schemaVersion: 1, branchId: branchHBT, classId: cls.toan9a, authorId: tc.maiHBT, title: 'Lịch học thêm cuối tuần', content: '<p>Buổi học bổ sung Chủ nhật 9h-11h tại phòng 201. Phụ huynh sắp xếp cho em tham dự.</p>', attachmentUrls: [], targetAudience: ['student', 'parent'], isPinned: true, notificationSent: true, notificationSentAt: daysAgo(7), createdAt: daysAgo(7), updatedAt: daysAgo(7), deletedAt: null },
            { schemaVersion: 1, branchId: branchCG, classId: cls.ly9a, authorId: tc.thanhCG, title: 'Thí nghiệm thực hành tuần tới', content: '<p>Buổi thứ Ba tuần tới có tiết thực hành. Các em mang bút chì và thước kẻ.</p>', attachmentUrls: [], targetAudience: ['student', 'parent'], isPinned: true, notificationSent: true, notificationSentAt: daysAgo(6), createdAt: daysAgo(6), updatedAt: daysAgo(6), deletedAt: null },
            { schemaVersion: 1, branchId: branchCG, classId: cls.toanCG, authorId: tc.longCG, title: 'Nhắc nhở nộp bài tập', content: '<p>Còn 5 bạn chưa nộp bài tập tuần trước. Hạn chót ngày mai.</p>', attachmentUrls: [], targetAudience: ['student'], isPinned: false, notificationSent: true, notificationSentAt: daysAgo(1), createdAt: daysAgo(1), updatedAt: daysAgo(1), deletedAt: null },
        ]);
        console.log('✅ ClassAnnouncements: 5');
        // ════════════════════════════════════════════════════════
        // 18. AUDIT LOGS
        // ════════════════════════════════════════════════════════
        const auditActors = [
            { id: staffHBT1, role: 'staff', name: 'Lê Thị Phương', branch: branchHBT },
            { id: staffCG1, role: 'staff', name: 'Hoàng Thị Lan', branch: branchCG },
            { id: tc.hungHBT, role: 'teacher', name: 'Nguyễn Văn Hùng', branch: branchHBT },
            { id: boHBT, role: 'branch_owner', name: 'Nguyễn Thu Hoa', branch: branchHBT },
            { id: boCG, role: 'branch_owner', name: 'Trần Đức Mạnh', branch: branchCG },
        ];
        const auditActions = [
            'UPDATE_SCORE', 'CONFIRM_PAYMENT', 'CREATE_ACCOUNT',
            'LOGIN', 'LOGOUT', 'FAILED_LOGIN', 'CHANGE_INVOICE', 'EXPORT_DATA',
        ];
        await AuditLog.insertMany(Array.from({ length: 40 }, () => {
            const actor = randItem(auditActors);
            const action = randItem(auditActions);
            const createdAt = daysAgo(randInt(0, 30));
            return {
                schemaVersion: 1,
                branchId: actor.branch,
                actorId: actor.id,
                actorRole: actor.role,
                actorName: actor.name,
                requestId: new Types.ObjectId().toString(),
                action,
                targetType: 'users',
                targetId: new Types.ObjectId(),
                before: action === 'UPDATE_SCORE' ? { score: randInt(4, 6) } : null,
                after: action === 'UPDATE_SCORE' ? { score: randInt(7, 10) } : null,
                ipAddress: `192.168.${randInt(1, 5)}.${randInt(10, 200)}`,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                createdAt,
                expiresAt: addDays(createdAt, 180),
            };
        }));
        console.log('✅ AuditLogs: 40');
        // ════════════════════════════════════════════════════════
        // TỔNG KẾT
        // ════════════════════════════════════════════════════════
        console.log('\n════════════════════════════════════════════');
        console.log('🎉 Seed data LCMS hoàn tất!');
        console.log('════════════════════════════════════════════');
        console.log('📧 Tài khoản mẫu (mật khẩu: Admin@123456):');
        console.log('   system_owner   → admin@lcms.vn');
        console.log('   branch_owner   → nguyen.thu.hoa@lcms.edu.vn  (CS Hai Bà Trưng)');
        console.log('   branch_owner   → tran.duc.manh@lcms.edu.vn   (CS Cầu Giấy)');
        console.log('   staff          → le.phuong@lcms.edu.vn');
        console.log('   teacher        → hung.nguyen@lcms.edu.vn      (Toán HBT)');
        console.log('   teacher        → long.dinh@lcms.edu.vn        (Toán+Hóa CG)');
        console.log('   student        → hs001@student.lcms.edu.vn');
        console.log('   parent         → ph001@parent.lcms.edu.vn');
        console.log('════════════════════════════════════════════\n');
    }
    catch (error) {
        console.error('❌ Lỗi khi seed data:', error);
    }
    finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};
seedData();
//# sourceMappingURL=seed.js.map