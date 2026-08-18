const express = require('express');

const controller = require('../controllers/animal.controller');
const queryController = require('../controllers/animal.query.controller');

const router = express.Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);
router.query('/', queryController.queryAnimals);

module.exports = router;