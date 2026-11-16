const { resilientAnimalService } = require('../../resilience');

// GET /api/v2/animals/random: the entity the coordinator (Medical API, GKE)
// reads from this API in the release 5 flow. The body is returned as is
// under the "animal" key of the flow response.
const createAnimalController = ({ service }) => ({
  getRandomAnimal: async (req, res, next) => {
    try {
      const { animal, degradado, motivo } = await service.getRandom();

      if (!animal) {
        return res.status(404).json({
          error: 'No animals found',
          traceId: req.traceId
        });
      }

      if (degradado) {
        res.setHeader('X-Degradado', 'true');
        return res.status(200).json({
          data: animal,
          traceId: req.traceId,
          degradado: true,
          motivo
        });
      }

      return res.status(200).json({
        data: animal,
        traceId: req.traceId
      });
    } catch (error) {
      if (error.status === 503) {
        res.setHeader('Retry-After', String(error.retryAfterSeconds));
        return res.status(503).json({
          error: error.message,
          motivo: error.motivo,
          traceId: req.traceId
        });
      }
      return next(error);
    }
  }
});

module.exports = {
  createAnimalController,
  ...createAnimalController({ service: resilientAnimalService })
};
