// src/models/user.model.ts
import mongoose, { Schema } from 'mongoose';
import { ROLES } from '../shared/constants/roles.js';
const UserSchema = new Schema({
    userCode: { type: String, required: true, unique: true, sparse: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.STUDENT },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: false },
    fullName: { type: String, required: true },
    phone: { type: String },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
//# sourceMappingURL=user.model.js.map