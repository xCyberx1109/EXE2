import { posDevicesService } from './posDevices.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const createPosDevice = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId || req.user.id;
  const data = await posDevicesService.createDevice(accountId, req.body, req);
  sendSuccess(res, { message: 'POS device created successfully', data, statusCode: 201 });
});

export const listPosDevices = asyncHandler(async (req, res) => {
  const data = await posDevicesService.listDevices(req.user);
  sendSuccess(res, { message: 'Devices retrieved successfully', data });
});

export const getPosDevice = asyncHandler(async (req, res) => {
  const data = await posDevicesService.getDevice(req.params.id, req.user);
  sendSuccess(res, { message: 'Device retrieved successfully', data });
});

export const regenerateSetupPin = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId || req.user.id;
  const data = await posDevicesService.regenerateSetupPin(req.body.deviceId, accountId, req);
  sendSuccess(res, { message: 'Setup PIN regenerated successfully', data });
});

export const revokePosDevice = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId || req.user.id;
  const data = await posDevicesService.revokeDevice(req.body.deviceId, req.body.reason, accountId, req);
  sendSuccess(res, { message: 'Device revoked successfully', data });
});

export const resetPosDevice = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId || req.user.id;
  const data = await posDevicesService.resetDevice(req.body.deviceId, accountId, req);
  sendSuccess(res, { message: 'Device reset successfully', data });
});

export const togglePosDevice = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId || req.user.id;
  const data = await posDevicesService.toggleDevice(req.params.id, req.body.active, accountId, req);
  sendSuccess(res, { message: 'Device status updated successfully', data });
});

export const deletePosDevice = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId || req.user.id;
  await posDevicesService.deleteDevice(req.params.id, accountId, req);
  sendSuccess(res, { message: 'Device deleted successfully', data: null });
});

export const updatePosDeviceMode = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId || req.user.id;
  const data = await posDevicesService.updateMode(req.params.id, req.body.mode, accountId, req);
  sendSuccess(res, { message: 'Device mode updated successfully', data });
});

export const getDeviceActivityLogs = asyncHandler(async (req, res) => {
  const data = await posDevicesService.getActivityLogs(req.params.id, req.user);
  sendSuccess(res, { message: 'Activity logs retrieved successfully', data });
});
