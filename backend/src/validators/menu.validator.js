import { body, param, query } from 'express-validator';

export const categoryRules = [
  body('name').trim().notEmpty().withMessage('Tên danh mục là bắt buộc'),
  body('description').optional().trim(),
];

export const menuItemRules = [
  body('name').trim().notEmpty().withMessage('Tên món là bắt buộc'),

  body('categoryId').optional({ values: 'null' }).isUUID().withMessage('categoryId không hợp lệ'),
  body('category').optional({ values: 'null' }).trim().notEmpty().withMessage('Tên danh mục không được để trống'),

  // Dùng custom validator thay vì notEmpty()+isFloat() vì validator.js
  // gọi assertString() bên trong, không xử lý được number type từ JSON body
  body('price')
    .exists().withMessage('Giá bán là bắt buộc')
    .bail()
    .custom((value) => {
      if (value === null || value === '') return false;
      const num = Number(value);
      return !isNaN(num) && isFinite(num) && num >= 0;
    }).withMessage('Giá bán phải là số >= 0'),

  body('cost')
    .exists().withMessage('Giá vốn là bắt buộc')
    .bail()
    .custom((value) => {
      if (value === null || value === '') return false;
      const num = Number(value);
      return !isNaN(num) && isFinite(num) && num >= 0;
    }).withMessage('Giá vốn phải là số >= 0'),

  body('description').optional().trim(),

  body('imageUrl').optional({ values: 'null' }).isURL().withMessage('imageUrl phải là URL hợp lệ'),

  // isBoolean() từ validator.js cũng gọi assertString → ko xử lý boolean
  body('available')
    .optional()
    .custom((value) => typeof value === 'boolean').withMessage('available phải là boolean'),
];

export const menuItemIdParam = [param('id').trim().notEmpty().withMessage('ID món là bắt buộc')];

export const menuSearchQuery = [
  query('search').optional().trim(),
  query('category').optional().trim(),
  query('categoryId').optional().isUUID(),
  query('available').optional().isIn(['true', 'false']),
];
