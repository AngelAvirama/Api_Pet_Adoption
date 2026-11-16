const animalService = require('../../services/animal.service');

// GET /api/v2/animals/random: the entity the coordinator (Medical API, GKE)
// reads from this API in the release 5 flow. The body is returned as is
// under the "animal" key of the flow response.
const getRandomAnimal = async (req, res, next) => {
  try {
    const animal = await animalService.getRandom();

    if (!animal) {
      return res.status(404).json({
        error: 'No animals found',
        traceId: req.traceId
      });
    }

    return res.status(200).json({
      data: animal,
      traceId: req.traceId
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getRandomAnimal
};
