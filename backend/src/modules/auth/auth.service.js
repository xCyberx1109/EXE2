import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../../config/index.js';
import prisma from '../../prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { userRepository } from '../../repositories/user.repository.js';

import { permissionService } from '../permissions/permission.service.js';


const SALT_ROUNDS = 10;

export const authService = {
  hashPassword: (password) => bcrypt.hash(password, SALT_ROUNDS),

  async register({ email, password, fullName }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError('Email đã được sử dụng', 409);
    }

    const hashedPassword = await this.hashPassword(password);

    const user = await userRepository.create({
      email,
      password: hashedPassword,
      fullName,
    });

    const token = await generateToken(user);
    const permissions = await permissionService.getEffectivePermissions(user.id);
    const permissionsVersion = await permissionService.getPermissionsVersion(user.id);
    return { user: { ...sanitizeUser(user), permissions, permissionsVersion }, token };
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

    const token = await generateToken(user);
    const permissions = await permissionService.getEffectivePermissions(user.id);
    const permissionsVersion = await permissionService.getPermissionsVersion(user.id);
    return { user: { ...sanitizeUser(user), permissions, permissionsVersion }, token };
  },

  async getProfile(userId) {
    const user = await userRepository.findById(userId);

    if (!user) throw new AppError('Không tìm thấy người dùng', 404);

    const paymentInfo = await prisma.branchBankAccount.findFirst({
      where: { branchId: userId, isDefault: true },
    }) || await prisma.branchBankAccount.findFirst({
      where: { branchId: userId },
      orderBy: { createdAt: 'asc' },
    }) || null;

    return {
      ...user,
      paymentInformation: paymentInfo ? {
        bankCode: paymentInfo.bankCode,
        bankName: paymentInfo.bankName,
        accountNumber: paymentInfo.accountNumber,
        accountHolder: paymentInfo.accountHolder,
        isDefault: paymentInfo.isDefault,
      } : null,
    };
  },

  async updateProfile(userId, { fullName, email }) {
    const currentUser = await userRepository.findRawById(userId);
    if (!currentUser) throw new AppError('Không tìm thấy người dùng', 404);

    const nextFullName = typeof fullName === 'string' ? fullName.trim() : undefined;
    const nextEmail = typeof email === 'string' ? email.trim().toLowerCase() : undefined;

    if (!nextFullName && !nextEmail) {
      throw new AppError('Vui lòng cung cấp thông tin cần cập nhật', 400);
    }

    const dataToUpdate = {};

    if (nextFullName) {
      dataToUpdate.fullName = nextFullName;
    }

    if (nextEmail && nextEmail !== currentUser.email) {
      const existedEmail = await userRepository.findByEmail(nextEmail);
      if (existedEmail && existedEmail.id !== userId) {
        throw new AppError('Email đã được sử dụng', 409);
      }
      dataToUpdate.email = nextEmail;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return this.getProfile(userId);
    }

    await userRepository.updateById(userId, dataToUpdate);
    return this.getProfile(userId);
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const currentUser = await userRepository.findRawById(userId);
    if (!currentUser) throw new AppError('Không tìm thấy người dùng', 404);

    const isMatch = await bcrypt.compare(currentPassword, currentUser.password);
    if (!isMatch) {
      throw new AppError('Mật khẩu hiện tại không chính xác', 400);
    }

    const sameAsCurrent = await bcrypt.compare(newPassword, currentUser.password);
    if (sameAsCurrent) {
      throw new AppError('Mật khẩu mới phải khác mật khẩu hiện tại', 400);
    }

    const hashedPassword = await this.hashPassword(newPassword);
    await userRepository.updateById(userId, { password: hashedPassword, mustChangePassword: false });

    return { success: true };
  },

  async resetPasswordForSelf(userId, requestId) {
    const currentUser = await userRepository.findRawById(userId);
    if (!currentUser) throw new AppError('Không tìm thấy người dùng', 404);

    const newPassword = crypto.randomBytes(4).toString('hex');
    const hashedPassword = await this.hashPassword(newPassword);

    await userRepository.updateById(userId, {
      password: hashedPassword,
      mustChangePassword: true,
    });

    return { email: currentUser.email, newPassword };
  },

  async getPaymentInfo(accountId) {
    return prisma.branchBankAccount.findFirst({
      where: { branchId: accountId, isDefault: true },
    });
  },

  async upsertPaymentInfo(accountId, { bankCode, bankName, accountNumber, accountHolder }) {
    const existing = await prisma.branchBankAccount.findFirst({
      where: { branchId: accountId, isDefault: true },
    });

    if (existing) {
      return prisma.branchBankAccount.update({
        where: { id: existing.id },
        data: { bankCode, bankName, accountNumber, accountHolder },
      });
    }

    return prisma.branchBankAccount.create({
      data: {
        branchId: accountId,
        bankCode,
        bankName,
        accountNumber,
        accountHolder,
        isDefault: true,
      },
    });
  },
};

const generateToken = async (user) => {
  const permissions = await permissionService.getEffectivePermissions(user.id);
  return jwt.sign(
    {
      userId: user.id,
      permissions,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
};

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  mustChangePassword: user.mustChangePassword,
  createdAt: user.createdAt,
});
