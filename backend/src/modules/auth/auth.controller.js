import { authService } from './auth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  sendSuccess(res, {
    message: 'Đăng ký thành công',
    data: result,
    statusCode: 201,
  });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendSuccess(res, { message: 'Đăng nhập thành công', data: result });
});

export const getMe = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Lấy thông tin thành công', data: req.user });
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user.id, req.body);
  sendSuccess(res, { message: 'Cập nhật thông tin thành công', data: user });
});

export const changeMyPassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body);
  sendSuccess(res, { message: 'Đổi mật khẩu thành công', data: null });
});

export const resetMyPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPasswordForSelf(req.user.id, req.requestId);
  sendSuccess(res, { message: 'Đặt lại mật khẩu thành công, mật khẩu mới đã được gửi tới email của bạn.', data: result });
});
