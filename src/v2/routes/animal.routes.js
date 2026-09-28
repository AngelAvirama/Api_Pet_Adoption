const express = require('express');
const animalController = require('../controllers/animal.controller');

const router = express.Router();

router.get('/animals', animalController.getAnimals);
router.get('/animals/random', animalController.getRandomAnimal);

module.exports = router;