import { posAuthService } from './posAuth.service.js';
import { posDeviceService } from './posDevice.service.js';
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

export const posCreateDevice = asyncHandler(async (req, res) => {
  const data = await posDeviceService.createDevice(req.user.id, req.body, req);
  sendSuccess(res, { message: 'Tạo thiết bị POS thành công', data, statusCode: 201 });
});

export const posListDevices = asyncHandler(async (req, res) => {
  const data = await posDeviceService.listDevices(req.user);
  sendSuccess(res, { message: 'Lấy danh sách thiết bị POS thành công', data });
});

export const posResetPin = asyncHandler(async (req, res) => {
  const data = await posDeviceService.resetPin(req.body.deviceId, req.user.id, req);
  sendSuccess(res, { message: 'Đặt lại PIN thiết bị thành công', data });
});

export const posToggleDevice = asyncHandler(async (req, res) => {
  const data = await posDeviceService.toggleDevice(req.params.id, req.body.active, req.user.id, req);
  sendSuccess(res, { message: 'Cập nhật trạng thái thiết bị thành công', data });
});
