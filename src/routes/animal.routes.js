const express = require('express');

const controller = require('../controllers/animal.controller');
const queryController = require('../controllers/animal.query.controller');

const animalValidator = require('../validators/animal.validator');
const validate = require('../middlewares/validation.middleware');

const router = express.Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', animalValidator, validate, controller.create);
router.put('/:id', animalValidator, validate, controller.update);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);
router.query('/', queryController.queryAnimals);

module.exports = router;