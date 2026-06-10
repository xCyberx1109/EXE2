import { body, param, query } from 'express-validator';

export const categoryRules = [
  body('name').trim().notEmpty().withMessage('Tên danh mục là bắt buộc'),
  body('description').optional().trim(),
];

export const menuItemRules = [
  body('name').trim().notEmpty().withMessage('Tên món là bắt buộc'),

  body('categoryId').notEmpty().withMessage('categoryId là bắt buộc'),

  body('price')
    .exists().withMessage('Giá bán là bắt buộc')
    .bail()
    .custom((value) => {
      if (value === null || value === '') return false;
      const num = Number(value);
      return !isNaN(num) && isFinite(num) && num > 0;
    }).withMessage('Giá bán phải là số > 0'),

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

  body('available')
    .optional()
    .custom((value) => typeof value === 'boolean').withMessage('available phải là boolean'),

  body('ingredients')
    .optional()
    .isArray().withMessage('ingredients phải là mảng'),
  body('ingredients.*.ingredientId')
    .if(body('ingredients').isArray({ min: 1 }))
    .notEmpty().withMessage('ingredientId không hợp lệ'),
  body('ingredients.*.amount')
    .if(body('ingredients').isArray({ min: 1 }))
    .isFloat({ min: 0.01 }).withMessage('Số lượng nguyên liệu phải > 0'),
];

export const menuItemUpdateRules = [
  body('name').optional().trim().notEmpty().withMessage('Tên món không được để trống'),

  body('categoryId').optional().notEmpty().withMessage('categoryId không được để trống'),

  body('price')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return false;
      const num = Number(value);
      return !isNaN(num) && isFinite(num) && num >= 0;
    }).withMessage('Giá bán phải là số >= 0'),

  body('cost')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return false;
      const num = Number(value);
      return !isNaN(num) && isFinite(num) && num >= 0;
    }).withMessage('Giá vốn phải là số >= 0'),

  body('description').optional().trim(),

  body('imageUrl').optional({ values: 'null' }).isURL().withMessage('imageUrl phải là URL hợp lệ'),

  body('available')
    .optional()
    .custom((value) => typeof value === 'boolean').withMessage('available phải là boolean'),

  body('ingredients').optional().isArray().withMessage('ingredients phải là mảng'),
  body('ingredients.*.ingredientId').optional().notEmpty().withMessage('ingredientId không hợp lệ'),
  body('ingredients.*.amount').optional().isFloat({ min: 0.01 }).withMessage('Số lượng phải > 0'),
];

export const menuItemIdParam = [param('id').trim().notEmpty().withMessage('ID món là bắt buộc')];

export const menuSearchQuery = [
  query('search').optional().trim(),
  query('category').optional().trim(),
  query('categoryId').optional().notEmpty(),
  query('available').optional().isIn(['true', 'false']),
  query('accountId').optional().notEmpty().withMessage('accountId không hợp lệ'),
];
