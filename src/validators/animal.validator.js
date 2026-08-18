const { body } = require('express-validator');

const animalValidator = [
  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio')
    .isLength({ max: 100 })
    .withMessage('El nombre no puede superar los 100 caracteres'),

  body('especie')
    .trim()
    .notEmpty()
    .withMessage('La especie es obligatoria')
    .isIn(['Perro', 'Gato'])
    .withMessage('La especie debe ser Perro o Gato'),

  body('raza')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('La raza no puede superar los 100 caracteres'),

  body('edad')
    .notEmpty()
    .withMessage('La edad es obligatoria')
    .isInt({ min: 0 })
    .withMessage('La edad debe ser un número entero mayor o igual a 0'),

  body('sexo')
    .trim()
    .notEmpty()
    .withMessage('El sexo es obligatorio')
    .isIn(['Macho', 'Hembra'])
    .withMessage('El sexo debe ser Macho o Hembra'),

  body('estado')
    .optional()
    .trim()
    .isIn(['DISPONIBLE', 'ADOPTADO'])
    .withMessage('El estado debe ser DISPONIBLE o ADOPTADO')
];

module.exports = animalValidator;