import mongoose, { Schema } from 'mongoose';
// ── Schema ───────────────────────────────────────────────────
const SessionSlotSchema = new Schema({
    name: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
}, { _id: false });
const RoomSchema = new Schema({
    code: { type: String, required: true },
    name: { type: String, required: true },
}, { _id: false });
const BranchSchema = new Schema({
    schemaVersion: { type: Number, default: 1 },
    branchCode: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    address: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    logoUrl: { type: String, default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    timezone: { type: String, default: 'Asia/Ho_Chi_Minh' },
    defaultFeePerSession: { type: Number, default: null },
    defaultSessionSlots: { type: [SessionSlotSchema], default: [] },
    rooms: { type: [RoomSchema], default: [] },
    isActive: { type: Boolean, required: true, default: true },
    deletedAt: { type: Date, default: null },
}, {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'branches',
});
// ── Indexes ──────────────────────────────────────────────────
BranchSchema.index({ branchCode: 1 }, { unique: true, name: 'idx_branches_code' });
BranchSchema.index({ isActive: 1 }, { name: 'idx_branches_active' });
export const Branch = mongoose.models.Branch || mongoose.model('Branch', BranchSchema, 'branches');
//# sourceMappingURL=branch.model.js.map