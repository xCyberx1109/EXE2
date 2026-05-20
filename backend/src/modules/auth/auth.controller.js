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
  const user = await authService.getProfile(req.user.id);
  sendSuccess(res, { message: 'Lấy thông tin thành công', data: user });
});
