const express = require('express');
const adopcionController = require('../controllers/adopcion.controller');

const router = express.Router();

router.get('/adopciones', adopcionController.getAdopciones);
router.get('/adopciones/random', adopcionController.getRandomAdopcion);

module.exports = router;