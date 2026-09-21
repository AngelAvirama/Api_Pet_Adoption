const express = require('express');
const adopcionController = require('../controllers/adopcion.controller');

const router = express.Router();

router.get('/adopciones', adopcionController.getAdopciones);

module.exports = router;