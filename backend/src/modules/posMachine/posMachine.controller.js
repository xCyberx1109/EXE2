import { posMachineService } from './posMachine.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

function logContext(req) {
  console.log('[ROUTE CONTEXT]', {
    url: req.originalUrl,
    user: req.user,
    posDevice: req.posDevice
  });
  
  const ctx = req.user || req.posDevice;
  console.log('[CONTROLLER]', {
    url: req.originalUrl,
    ctx
  });
}

export const loginPosMachine = asyncHandler(async (req, res) => {
  logContext(req);
  const data = await posMachineService.loginWithPin(req.body, req);
  sendSuccess(res, { message: 'Đăng nhập máy POS thành công', data, statusCode: 200 });
});

export const loginPosMachineByPin = asyncHandler(async (req, res) => {
  logContext(req);
  const data = await posMachineService.loginByPin(req.body, req);
  const message = data.requiresMachineSelection
    ? 'Vui lòng chọn máy POS'
    : 'Đăng nhập máy POS thành công';
  sendSuccess(res, { message, data, statusCode: 200 });
});

export const listActivePosMachines = asyncHandler(async (req, res) => {
  const accountId = req.query.accountId;
  const data = await posMachineService.listActiveMachines(accountId);
  sendSuccess(res, { message: 'Danh sách máy POS đang hoạt động', data });
});

export const listPosMachines = asyncHandler(async (req, res) => {
  logContext(req);
  const accountId = req.user.accountId || req.user.id;
  console.log("[POS] listPosMachines controller - accountId extracted:", accountId, "| req.user:", JSON.stringify({ id: req.user?.id, accountId: req.user?.accountId, source: req.user?.source }));
  const data = await posMachineService.listMachines(accountId);
  sendSuccess(res, { message: 'Danh sách máy POS', data });
});

export const getPosMachine = asyncHandler(async (req, res) => {
  logContext(req);
  const accountId = req.user.accountId || req.user.id;
  const data = await posMachineService.getMachine(req.params.id, accountId);
  sendSuccess(res, { message: 'Thông tin máy POS', data });
});

export const createPosMachine = asyncHandler(async (req, res) => {
  logContext(req);
  const accountId = req.user.accountId || req.user.id;
  const data = await posMachineService.createMachine(accountId, req.body, req);
  sendSuccess(res, { message: 'Tạo máy POS thành công', data, statusCode: 201 });
});

export const updatePosMachine = asyncHandler(async (req, res) => {
  logContext(req);
  const accountId = req.user.accountId || req.user.id;
  const data = await posMachineService.updateMachine(req.params.id, accountId, req.body, req);
  sendSuccess(res, { message: 'Cập nhật máy POS thành công', data });
});

export const resetPosMachinePin = asyncHandler(async (req, res) => {
  logContext(req);
  const accountId = req.user.accountId || req.user.id;
  const data = await posMachineService.resetPin(req.params.id, accountId, req);
  sendSuccess(res, { message: 'Đặt lại mã PIN thành công', data });
});

export const toggleLockPosMachine = asyncHandler(async (req, res) => {
  logContext(req);
  const accountId = req.user.accountId || req.user.id;
  const data = await posMachineService.toggleLockMachine(req.params.id, accountId, req);
  sendSuccess(res, { message: 'Cập nhật trạng thái máy POS thành công', data });
});

export const deletePosMachine = asyncHandler(async (req, res) => {
  logContext(req);
  const accountId = req.user.accountId || req.user.id;
  await posMachineService.deleteMachine(req.params.id, accountId, req);
  sendSuccess(res, { message: 'Xóa máy POS thành công', data: null });
});


