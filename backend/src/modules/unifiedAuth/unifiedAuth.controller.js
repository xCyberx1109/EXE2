import { unifiedAuthService } from './unifiedAuth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const register = asyncHandler(async (req, res) => {
  const result = await unifiedAuthService.register(req.body);
  sendSuccess(res, { message: 'Đăng ký thành công', data: result, statusCode: 201 });
});

export const login = asyncHandler(async (req, res) => {
  const result = await unifiedAuthService.loginWithEmail(req.body, req);
  sendSuccess(res, { message: 'Đăng nhập thành công', data: result });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await unifiedAuthService.getProfile(req.user.id);
  sendSuccess(res, { message: 'Lấy thông tin thành công', data: user });
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await unifiedAuthService.updateProfile(req.user.id, req.body);
  sendSuccess(res, { message: 'Cập nhật thông tin thành công', data: user });
});

export const changeMyPassword = asyncHandler(async (req, res) => {
  await unifiedAuthService.changePassword(req.user.id, req.body);
  sendSuccess(res, { message: 'Đổi mật khẩu thành công', data: null });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await unifiedAuthService.forgotPassword(req.body);
  sendSuccess(res, { message: result.message, data: null });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await unifiedAuthService.resetPassword(req.body);
  sendSuccess(res, { message: result.message, data: null });
});
