import { User } from '../../models/user.model.js';
export class AuthRepository {
    async findByEmail(email) {
        return User.findOne({ email });
    }
    async findById(id) {
        return User.findById(id).select('-passwordHash'); // Exclude password mặc định
    }
    async create(userData) {
        const user = new User(userData);
        return user.save();
    }
}
//# sourceMappingURL=auth.repository.js.map