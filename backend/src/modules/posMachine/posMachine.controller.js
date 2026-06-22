import { posMachineService } from './posMachine.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const loginPosMachine = asyncHandler(async (req, res) => {
  const data = await posMachineService.loginWithPin(req.body, req);
  sendSuccess(res, { message: 'Đăng nhập máy POS thành công', data, statusCode: 200 });
});

export const listPosMachines = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId || req.user.id;
  const data = await posMachineService.listMachines(accountId);
  sendSuccess(res, { message: 'Danh sách máy POS', data });
});

export const getPosMachine = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId || req.user.id;
  const data = await posMachineService.getMachine(req.params.id, accountId);
  sendSuccess(res, { message: 'Thông tin máy POS', data });
});

export const createPosMachine = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId || req.user.id;
  const data = await posMachineService.createMachine(accountId, req.body, req);
  sendSuccess(res, { message: 'Tạo máy POS thành công', data, statusCode: 201 });
});

export const updatePosMachine = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId || req.user.id;
  const data = await posMachineService.updateMachine(req.params.id, accountId, req.body, req);
  sendSuccess(res, { message: 'Cập nhật máy POS thành công', data });
});

export const resetPosMachinePin = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId || req.user.id;
  const data = await posMachineService.resetPin(req.params.id, accountId, req);
  sendSuccess(res, { message: 'Đặt lại mã PIN thành công', data });
});

export const toggleLockPosMachine = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId || req.user.id;
  const data = await posMachineService.toggleLockMachine(req.params.id, accountId, req);
  sendSuccess(res, { message: 'Cập nhật trạng thái máy POS thành công', data });
});

export const deletePosMachine = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId || req.user.id;
  await posMachineService.deleteMachine(req.params.id, accountId, req);
  sendSuccess(res, { message: 'Xóa máy POS thành công', data: null });
});

export const updatePosMachinePermissions = asyncHandler(async (req, res) => {
  const accountId = req.user.accountId || req.user.id;
  await posMachineService.updatePermissions(req.params.id, accountId, req.body.permissions, req);
  sendSuccess(res, { message: 'Cập nhật permission máy POS thành công', data: null });
});
