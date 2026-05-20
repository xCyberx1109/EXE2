/** Chuẩn response API cho frontend quản lý */
export const sendSuccess = (res, { message = 'Thành công', data = null, statusCode = 200 }) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (res, { message = 'Có lỗi xảy ra', error = null, statusCode = 500 }) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error,
  });
};
