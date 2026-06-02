import { staffAuthService } from './staffAuth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const staffLoginPin = asyncHandler(async (req, res) => {
  const data = await staffAuthService.loginWithPin(req.posDevice, req.body, req);
  sendSuccess(res, { message: 'Staff login successful', data });
});

export const staffLogout = asyncHandler(async (req, res) => {
  const accountId = req.body.accountId || null;
  await staffAuthService.logout(req.posDevice, accountId, req);
  sendSuccess(res, { message: 'Staff logout successful', data: null });
});

export const staffSwitch = asyncHandler(async (req, res) => {
  const data = await staffAuthService.switchStaff(req.posDevice, req.body, req);
  sendSuccess(res, { message: 'Staff switched successfully', data });
});

export const getActiveStaff = asyncHandler(async (req, res) => {
  const data = await staffAuthService.getActiveStaffOnDevice(req.posDevice);
  sendSuccess(res, { message: 'Active staff retrieved', data });
});
