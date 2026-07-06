import { body, param, query } from 'express-validator';

const imageUrlRule = body('imageUrl')
  .optional({ values: 'null' })
  .isURL({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
    require_tld: false,
  })
  .withMessage('imageUrl phai la URL hop le');

export const menuItemRules = [
  body('name').trim().notEmpty().withMessage('Ten mon la bat buoc'),
  body('price')
    .exists().withMessage('Gia ban la bat buoc')
    .bail()
    .custom((value) => {
      if (value === null || value === '') return false;
      const num = Number(value);
      return !isNaN(num) && isFinite(num) && num >= 0;
    }).withMessage('Gia ban phai la so >= 0'),
  body('cost')
    .exists().withMessage('Gia von la bat buoc')
    .bail()
    .custom((value) => {
      if (value === null || value === '') return false;
      const num = Number(value);
      return !isNaN(num) && isFinite(num) && num >= 0;
    }).withMessage('Gia von phai la so >= 0'),
  body('description').optional().trim(),
  imageUrlRule,
  body('available')
    .optional()
    .custom((value) => typeof value === 'boolean').withMessage('available phai la boolean'),
];

export const menuItemUpdateRules = [
  body('name').optional().trim().notEmpty().withMessage('Ten mon khong duoc de trong'),
  body('price')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return false;
      const num = Number(value);
      return !isNaN(num) && isFinite(num) && num >= 0;
    }).withMessage('Gia ban phai la so >= 0'),
  body('cost')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return false;
      const num = Number(value);
      return !isNaN(num) && isFinite(num) && num >= 0;
    }).withMessage('Gia von phai la so >= 0'),
  body('description').optional().trim(),
  imageUrlRule,
  body('available')
    .optional()
    .custom((value) => typeof value === 'boolean').withMessage('available phai la boolean'),
  body('ingredients').optional().isArray().withMessage('ingredients phai la mang'),
  body('ingredients.*.ingredientId').optional().notEmpty().withMessage('ingredientId khong hop le'),
  body('ingredients.*.amount').optional().isFloat({ min: 0.01 }).withMessage('So luong phai > 0'),
];

export const menuItemIdParam = [param('id').trim().notEmpty().withMessage('ID mon la bat buoc')];

export const menuSearchQuery = [
  query('search').optional().trim(),
  query('available').optional().isIn(['true', 'false']),
  query('accountId').optional().notEmpty().withMessage('accountId khong hop le'),
];
