const { body } = require('express-validator');

const adoptanteValidator = [
  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio')
    .isLength({ max: 100 })
    .withMessage('El nombre no puede superar los 100 caracteres'),

  body('apellido')
    .trim()
    .notEmpty()
    .withMessage('El apellido es obligatorio')
    .isLength({ max: 100 })
    .withMessage('El apellido no puede superar los 100 caracteres'),

  body('documento')
    .trim()
    .notEmpty()
    .withMessage('El documento es obligatorio')
    .isLength({ min: 5, max: 20 })
    .withMessage('El documento debe tener entre 5 y 20 caracteres'),

  body('telefono')
    .trim()
    .notEmpty()
    .withMessage('El teléfono es obligatorio')
    .isLength({ min: 7, max: 20 })
    .withMessage('El teléfono debe tener entre 7 y 20 caracteres'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('El email es obligatorio')
    .isEmail()
    .withMessage('Debe proporcionar un email válido'),

  body('direccion')
    .trim()
    .notEmpty()
    .withMessage('La dirección es obligatoria')
    .isLength({ max: 200 })
    .withMessage('La dirección no puede superar los 200 caracteres')
];

module.exports = adoptanteValidator;