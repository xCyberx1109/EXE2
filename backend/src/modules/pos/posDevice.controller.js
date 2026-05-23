import { posDeviceService } from './posDevice.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const createPosDevice = asyncHandler(async (req, res) => {
  const data = await posDeviceService.createDevice(req.user.id, req.body, req);
  sendSuccess(res, { message: 'Tạo thiết bị POS thành công', data, statusCode: 201 });
});

export const listPosDevices = asyncHandler(async (req, res) => {
  const data = await posDeviceService.listDevices(req.user);
  sendSuccess(res, { message: 'Lấy danh sách thiết bị POS thành công', data });
});

export const getPosDevice = asyncHandler(async (req, res) => {
  const data = await posDeviceService.getDevice(req.params.id, req.user);
  sendSuccess(res, { message: 'Lấy thông tin thiết bị POS thành công', data });
});

export const resetPosPin = asyncHandler(async (req, res) => {
  const data = await posDeviceService.resetPin(req.body.deviceId, req.user.id, req);
  sendSuccess(res, { message: 'Đặt lại PIN thiết bị thành công', data });
});

export const togglePosDevice = asyncHandler(async (req, res) => {
  const data = await posDeviceService.toggleDevice(req.params.id, req.body.active, req.user.id, req);
  sendSuccess(res, { message: 'Cập nhật trạng thái thiết bị thành công', data });
});

export const deletePosDevice = asyncHandler(async (req, res) => {
  await posDeviceService.deleteDevice(req.params.id, req.user.id, req);
  sendSuccess(res, { message: 'Xóa thiết bị POS thành công', data: null });
});
