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

module.exports = {
  getAnimals
};