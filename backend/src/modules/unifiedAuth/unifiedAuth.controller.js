import { unifiedAuthService } from './unifiedAuth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const register = asyncHandler(async (req, res) => {
  const result = await unifiedAuthService.register(req.body);
  sendSuccess(res, { message: 'Đăng ký thành công', data: result, statusCode: 201 });
});

export const login = asyncHandler(async (req, res) => {
  console.log('[LOGIN] Controller start');
  const result = await unifiedAuthService.loginWithEmail(req.body, req);
  console.log('[LOGIN] Controller calling sendSuccess');
  sendSuccess(res, { message: 'Đăng nhập thành công', data: result });
  console.log('[LOGIN] Controller done');
});

export const deviceLogin = asyncHandler(async (req, res) => {
  const result = await unifiedAuthService.loginWithDevicePin(req.body, req);
  sendSuccess(res, { message: 'Đăng nhập thiết bị thành công', data: result });
});

export const deviceRefresh = asyncHandler(async (req, res) => {
  const result = await unifiedAuthService.refreshDeviceToken(req.posDevice.id, req.body.refreshToken, req);
  sendSuccess(res, { message: 'Refresh token thành công', data: result });
});

export const deviceLogout = asyncHandler(async (req, res) => {
  await unifiedAuthService.logoutDevice(req.posDevice.id, req);
  sendSuccess(res, { message: 'Đăng xuất thiết bị thành công', data: null });
});

export const revokeSession = asyncHandler(async (req, res) => {
  await unifiedAuthService.revokeDeviceSession(req.params.sessionId, req);
  sendSuccess(res, { message: 'Thu hồi session thành công', data: null });
});

export const getSessions = asyncHandler(async (req, res) => {
  const data = await unifiedAuthService.getDeviceSessions(req.posDevice.id);
  sendSuccess(res, { message: 'Lấy danh sách session thành công', data });
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
