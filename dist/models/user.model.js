import mongoose, { Schema } from 'mongoose';
import { ROLES, GENDERS, RELATIONSHIPS, } from '../shared/constants/roles.js';
// ── Sub-schemas ──────────────────────────────────────────────
const StudentInfoSchema = new Schema({
    activeClassIds: { type: [Schema.Types.ObjectId], ref: 'Class', default: [] },
    enrollmentDate: { type: Date, default: null },
    parentIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    schoolName: { type: String, default: null },
    grade: { type: Number, default: null },
}, { _id: false });
const ParentInfoSchema = new Schema({
    studentIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    relationship: {
        type: String,
        enum: [...Object.values(RELATIONSHIPS), null],
        default: null,
    },
}, { _id: false });
const TeacherInfoSchema = new Schema({
    subjects: { type: [String], default: [] },
    joinDate: { type: Date, default: null },
    activeClassIds: { type: [Schema.Types.ObjectId], ref: 'Class', default: [] },
}, { _id: false });
// ── Main schema ──────────────────────────────────────────────
const UserSchema = new Schema({
    schemaVersion: { type: Number, default: 1 },
    userCode: { type: String, sparse: true, default: null },
    email: { type: String, sparse: true },
    phone: { type: String, sparse: true, default: null },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    fullName: { type: String, required: true },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, enum: [...Object.values(GENDERS), null], default: null },
    avatarUrl: { type: String, default: null },
    studentInfo: { type: StudentInfoSchema, default: null },
    parentInfo: { type: ParentInfoSchema, default: null },
    teacherInfo: { type: TeacherInfoSchema, default: null },
    isActive: { type: Boolean, required: true, default: true },
    lastLoginAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'users',
    toJSON: {
        transform: (_doc, ret) => {
            delete ret.passwordHash;
            return ret;
        },
    },
    toObject: {
        transform: (_doc, ret) => {
            delete ret.passwordHash;
            return ret;
        },
    },
});
// ── Indexes ──────────────────────────────────────────────────
// Phase 1: email là login chính — unique
UserSchema.index({ email: 1 }, { unique: true, sparse: true, name: 'idx_users_email' });
// Phase 2: nâng lên unique:true khi bật login SĐT
UserSchema.index({ phone: 1 }, { sparse: true, name: 'idx_users_phone' });
UserSchema.index({ userCode: 1 }, { unique: true, sparse: true, name: 'idx_users_code' });
UserSchema.index({ branchId: 1, role: 1 }, { name: 'idx_users_branch_role' });
// Q04: HS chưa xếp lớp nào
UserSchema.index({ branchId: 1, role: 1, 'studentInfo.activeClassIds': 1 }, { name: 'idx_users_student_active_classes' });
// GV chưa/đang dạy lớp
UserSchema.index({ branchId: 1, role: 1, 'teacherInfo.activeClassIds': 1 }, { name: 'idx_users_teacher_active_classes' });
// Tìm PH theo con — gửi thông báo
UserSchema.index({ 'parentInfo.studentIds': 1 }, { sparse: true, name: 'idx_users_parent_students' });
// Full-text tìm tên
UserSchema.index({ fullName: 'text' }, { name: 'idx_users_fullname_text' });
UserSchema.index({ deletedAt: 1 }, { sparse: true, name: 'idx_users_deleted' });
export const User = mongoose.models.User || mongoose.model('User', UserSchema, 'users');
//# sourceMappingURL=user.model.js.map