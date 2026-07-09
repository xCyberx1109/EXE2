import { paymentFlowService } from './payment.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const initiatePayment = asyncHandler(async (req, res) => {
  const ctx = req.user || req.employee;
  const employeeId = req.authType === 'employee' ? req.employee?.id : null;
  const data = await paymentFlowService.initiatePayment(req.params.id, req.body, ctx, employeeId);
  sendSuccess(res, { message: 'Khởi tạo thanh toán thành công', data });
});

export const confirmPayment = asyncHandler(async (req, res) => {
  const ctx = req.user || req.employee;
  const employeeId = req.authType === 'employee' ? req.employee?.id : null;
  const data = await paymentFlowService.confirmPayment(req.params.id, req.body, ctx, employeeId);
  sendSuccess(res, { message: 'Xác nhận thanh toán thành công', data });
});

export const cancelPayment = asyncHandler(async (req, res) => {
  const ctx = req.user || req.employee;
  const employeeId = req.authType === 'employee' ? req.employee?.id : null;
  const data = await paymentFlowService.cancelPayment(req.params.id, ctx, employeeId);
  sendSuccess(res, { message: 'Hủy thanh toán thành công', data });
});
