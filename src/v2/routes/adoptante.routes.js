const express = require('express');
const adoptanteController = require('../controllers/adoptante.controller');

const router = express.Router();

router.get('/adoptantes', adoptanteController.getAdoptantes);

module.exports = router;