import { posAuthService } from './posAuth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const posLogin = asyncHandler(async (req, res) => {
  const result = await posAuthService.login(req.body, req);
  sendSuccess(res, { message: 'Đăng nhập POS thành công', data: result });
});

export const posLogout = asyncHandler(async (req, res) => {
  await posAuthService.logout(req.posDevice, req);
  sendSuccess(res, { message: 'Đăng xuất POS thành công', data: null });
});

export const posPing = asyncHandler(async (req, res) => {
  const data = await posAuthService.ping(req.posDevice);
  sendSuccess(res, { message: 'OK', data });
});

export const posProfile = asyncHandler(async (req, res) => {
  const data = await posAuthService.getProfile(req.posDevice);
  sendSuccess(res, { message: 'Lấy thông tin POS thành công', data });
});
