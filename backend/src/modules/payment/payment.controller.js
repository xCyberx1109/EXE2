import { paymentFlowService } from './payment.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const initiatePayment = asyncHandler(async (req, res) => {
  const data = await paymentFlowService.initiatePayment(req.params.id, req.body, req.user);
  sendSuccess(res, { message: 'Khởi tạo thanh toán thành công', data });
});

export const confirmPayment = asyncHandler(async (req, res) => {
  const data = await paymentFlowService.confirmPayment(req.params.id, req.body, req.user);
  sendSuccess(res, { message: 'Xác nhận thanh toán thành công', data });
});

export const cancelPayment = asyncHandler(async (req, res) => {
  const data = await paymentFlowService.cancelPayment(req.params.id, req.user);
  sendSuccess(res, { message: 'Hủy thanh toán thành công', data });
});
