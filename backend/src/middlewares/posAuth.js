import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import prisma from '../prisma/client.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Xác thực POS Device bằng JWT riêng
 * - Verify JWT
 * - Tìm device bằng deviceToken
 * - Kiểm tra active/status
 * - Gắn req.posDevice, req.branch
 */
export const requirePosAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Vui lòng đăng nhập POS', 401);
  }

  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, config.posJwt.secret);

  const device = await prisma.posDevice.findFirst({
    where: { deviceToken: token, deletedAt: null },
    include: { branch: true },
  });

  if (!device) {
    throw new AppError('Phiên đăng nhập không hợp lệ', 401);
  }

  if (!device.active) {
    throw new AppError('Thiết bị đã bị vô hiệu hóa', 403);
  }

  req.posDevice = device;
  req.branch = device.branch;
  next();
});
