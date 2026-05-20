/** Bọc async route handler, chuyển lỗi sang error middleware */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
