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

const getAnimalRecommendations = async (req, res, next) => {
  try {
    const { especie, sexo, edadMaxima } = req.query;

    const animals = await animalService.getAll();

    const recommendations = animals.filter((animal) => {
      const isAvailable = animal.estado === 'DISPONIBLE';
      const matchesSpecies = !especie ||
        animal.especie.toLowerCase() === especie.toLowerCase();
      const matchesSex = !sexo ||
        animal.sexo.toLowerCase() === sexo.toLowerCase();
      const matchesAge = !edadMaxima ||
        animal.edad <= Number(edadMaxima);

      return isAvailable && matchesSpecies && matchesSex && matchesAge;
    });

    res.status(200).json({
      version: 'v4',
      track: 'canary',
      count: recommendations.length,
      filters: {
        especie: especie || null,
        sexo: sexo || null,
        edadMaxima: edadMaxima ? Number(edadMaxima) : null
      },
      data: recommendations,
      traceId: req.traceId
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnimals,
  getRandomAnimal,
  getAnimalComposition,
  getAnimalRecommendations
};