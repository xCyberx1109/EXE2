import { shiftService } from './shift.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const openShift = asyncHandler(async (req, res) => {
  const data = await shiftService.openShift(req.posDevice, req.body, req);
  sendSuccess(res, { message: 'Shift opened successfully', data });
});

export const closeShift = asyncHandler(async (req, res) => {
  const data = await shiftService.closeShift(req.posDevice, req.body, req);
  sendSuccess(res, { message: 'Shift closed successfully', data });
});

export const getCurrentShift = asyncHandler(async (req, res) => {
  const data = await shiftService.getCurrentShift(req.posDevice);
  sendSuccess(res, { message: 'Current shift retrieved', data });
});

export const getShiftHistory = asyncHandler(async (req, res) => {
  const data = await shiftService.getShiftHistory(req.posDevice, req.query);
  sendSuccess(res, { message: 'Shift history retrieved', data });
});

export const getShiftById = asyncHandler(async (req, res) => {
  const data = await shiftService.getShiftById(req.params.id, req.posDevice);
  sendSuccess(res, { message: 'Shift retrieved', data });
});
