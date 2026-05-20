import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../../config/index.js';
import { AppError } from '../../utils/AppError.js';
import { userRepository } from '../../repositories/user.repository.js';

const SALT_ROUNDS = 10;

export const authService = {
  async register({ email, password, fullName, role }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError('Email đã được sử dụng', 409);
    }

    const normalizedRole = role?.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF';
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await userRepository.create({
      email,
      password: hashedPassword,
      fullName,
      role: normalizedRole,
    });

    const token = generateToken(user.id);
    return { user: sanitizeUser(user), token };
  },

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    const token = generateToken(user.id);
    return { user: sanitizeUser(user), token };
  },

  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError('Không tìm thấy người dùng', 404);
    return user;
  },
};

const generateToken = (userId) =>
  jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  isSuperAdmin: user.isSuperAdmin,
  branchId: user.branchId,
  createdAt: user.createdAt,
});
