const animalService = require('../../services/animal.service');
const {
  getRandomVuelo,
  getRandomImagen
} = require('../services/external.service');

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

const getAnimalComposition = async (req, res, next) => {
  try {
    const animal = await animalService.getById(Number(req.params.id));

    if (!animal) {
      return res.status(404).json({
        error: 'Animal not found',
        traceId: req.traceId
      });
    }

    const [vuelo, imagen] = await Promise.all([
      getRandomVuelo(),
      getRandomImagen()
    ]);

    res.status(200).json({
      data: {
        animal,
        vuelo,
        imagen
      },
      traceId: req.traceId
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnimals,
  getRandomAnimal,
  getAnimalComposition
};