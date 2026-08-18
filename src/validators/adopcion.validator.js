const { body } = require('express-validator');

const adopcionValidator = [
  body('animalId')
    .notEmpty()
    .withMessage('El animalId es obligatorio')
    .isInt({ min: 1 })
    .withMessage('El animalId debe ser un número entero positivo'),

  body('adoptanteId')
    .notEmpty()
    .withMessage('El adoptanteId es obligatorio')
    .isInt({ min: 1 })
    .withMessage('El adoptanteId debe ser un número entero positivo'),

  body('estado')
    .optional()
    .trim()
    .isIn(['PENDIENTE', 'APROBADA', 'CANCELADA'])
    .withMessage(
      'El estado debe ser PENDIENTE, APROBADA o CANCELADA'
    )
];

module.exports = adopcionValidator;