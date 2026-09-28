const animalService = require('../../services/animal.service');

const getAnimals = async (req, res, next) => {
  try {
    const animals = await animalService.getAll();

    res.status(200).json({
      data: animals,
      traceId: req.traceId
    });
  } catch (error) {
    next(error);
  }
};

const getRandomAnimal = async (req, res, next) => {
  try {
    const animal = await animalService.getRandom();

    if (!animal) {
      return res.status(404).json({
        error: 'No animals found',
        traceId: req.traceId
      });
    }

    res.status(200).json({
      data: animal,
      traceId: req.traceId
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnimals,
  getRandomAnimal
};