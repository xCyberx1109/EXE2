import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { qrMenuService } from './qrMenu.service.js';

export const listTableLinks = asyncHandler(async (req, res) => {
  const user = req.user || req.employee;
  const data = await qrMenuService.listTableLinks(user);
  sendSuccess(res, { message: 'Lấy danh sách QR bàn thành công', data });
});

export const resolvePublicMenu = asyncHandler(async (req, res) => {
  const data = await qrMenuService.resolvePublicMenu(req.query.t);
  sendSuccess(res, { message: 'Lấy menu QR thành công', data });
});

export const submitPublicOrder = asyncHandler(async (req, res) => {
  const data = await qrMenuService.submitPublicOrder(req.query.t, req.body);
  sendSuccess(res, {
    message: 'Gửi order thành công',
    data,
    statusCode: 201,
  });
});
