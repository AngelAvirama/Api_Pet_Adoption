
const animalService = require('../../services/animal.service');
const {
  getRandomVuelo,
  getRandomImagen
} = require('../services/external.service');
const {
  animalRecommendationRequestsTotal,
  animalsRecommendedTotal
} = require('../../config/metrics');
const {
  publishAnimalRecommendationMetrics
} = require('../../config/cloudwatchEmf');

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

    if (especie !== undefined &&
        (typeof especie !== 'string' || !especie.trim())) {
      return res.status(400).json({
        error: 'especie must be a non-empty string',
        traceId: req.traceId
      });
    }

    if (sexo !== undefined &&
        (typeof sexo !== 'string' || !sexo.trim())) {
      return res.status(400).json({
        error: 'sexo must be a non-empty string',
        traceId: req.traceId
      });
    }

    let maxAge;

    if (edadMaxima !== undefined) {
      if (
        typeof edadMaxima !== 'string' ||
        edadMaxima.trim() === '' ||
        !/^\d+$/.test(edadMaxima)
      ) {
        return res.status(400).json({
          error: 'edadMaxima must be a non-negative integer',
          traceId: req.traceId
        });
      }

      maxAge = Number(edadMaxima);
    }

    const normalizedSpecies = especie?.trim().toLowerCase();
    const normalizedSex = sexo?.trim().toLowerCase();

    const animals = await animalService.getAll();

    const recommendations = animals.filter((animal) => {
      const isAvailable = animal.estado === 'DISPONIBLE';

      const matchesSpecies = !normalizedSpecies ||
        animal.especie.toLowerCase() === normalizedSpecies;

      const matchesSex = !normalizedSex ||
        animal.sexo.toLowerCase() === normalizedSex;

      const matchesAge = maxAge === undefined ||
        animal.edad <= maxAge;

      return isAvailable &&
        matchesSpecies &&
        matchesSex &&
        matchesAge;
    });

    const metricLabels = {
      app_version: req.appVersion || 'unknown',
      app_track: req.appTrack || 'unknown'
    };

    animalRecommendationRequestsTotal.inc(metricLabels);
    animalsRecommendedTotal.inc(metricLabels, recommendations.length);

    publishAnimalRecommendationMetrics({
      appVersion: metricLabels.app_version,
      appTrack: metricLabels.app_track,
      recommendedCount: recommendations.length
    });
    
    res.status(200).json({
      version: 'v4',
      track: 'canary',
      count: recommendations.length,
      filters: {
        especie: normalizedSpecies || null,
        sexo: normalizedSex || null,
        edadMaxima: maxAge ?? null
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
