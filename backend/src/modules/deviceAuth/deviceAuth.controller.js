import { deviceAuthService } from './deviceAuth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const deviceRefresh = asyncHandler(async (req, res) => {
  const data = await deviceAuthService.refreshToken(req.posDevice, req);
  sendSuccess(res, { message: 'Token refreshed successfully', data });
});

export const deviceLogout = asyncHandler(async (req, res) => {
  await deviceAuthService.logout(req.posDevice, req);
  sendSuccess(res, { message: 'Device logged out successfully', data: null });
});
