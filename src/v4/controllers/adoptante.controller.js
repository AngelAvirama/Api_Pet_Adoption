const adoptanteService = require('../../services/adoptante.service');

const getAdoptantes = async (req, res, next) => {
  try {
    const adoptantes = await adoptanteService.getAll();

    res.status(200).json({
      data: adoptantes,
      traceId: req.traceId
    });
  } catch (error) {
    next(error);
  }
};

const getRandomAdoptante = async (req, res, next) => {
  try {
    const adoptante = await adoptanteService.getRandom();

    if (!adoptante) {
      return res.status(404).json({
        error: 'No adoptantes found',
        traceId: req.traceId
      });
    }

    res.status(200).json({
      data: adoptante,
      traceId: req.traceId
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdoptantes,
  getRandomAdoptante
};