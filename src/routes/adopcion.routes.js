const express = require('express');

const controller = require('../controllers/adopcion.controller');
const queryController = require('../controllers/adopcion.query.controller');

const adopcionValidator = require('../validators/adopcion.validator');
const validate = require('../middlewares/validation.middleware');

const router = express.Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', adopcionValidator, validate, controller.create);
router.put('/:id', adopcionValidator, validate, controller.update);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);
router.query('/', queryController.queryAdopciones);

module.exports = router;