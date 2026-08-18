const express = require('express');

const controller = require('../controllers/adoptante.controller');
const queryController = require('../controllers/adoptante.query.controller');

const adoptanteValidator = require('../validators/adoptante.validator');
const validate = require('../middlewares/validation.middleware');

const router = express.Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', adoptanteValidator, validate, controller.create);
router.put('/:id', adoptanteValidator, validate, controller.update);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);
router.query('/', queryController.queryAdoptantes);

module.exports = router;