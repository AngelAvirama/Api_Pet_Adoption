const express = require('express');

const controller = require('../controllers/adoptante.controller');
const queryController = require('../controllers/adoptante.query.controller');

const router = express.Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);
router.query('/', queryController.queryAdoptantes);

module.exports = router;