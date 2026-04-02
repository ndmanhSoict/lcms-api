import mongoose, { Schema } from 'mongoose';
const BranchSchema = new Schema({
    branchCode: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    isActive: { type: Boolean, default: true },
    defaultSessionSlots: { type: [String], default: [] },
    deletedAt: { type: Date, default: null },
}, { timestamps: true });
export const Branch = mongoose.models.Branch || mongoose.model('Branch', BranchSchema);
//# sourceMappingURL=branch.model.js.map