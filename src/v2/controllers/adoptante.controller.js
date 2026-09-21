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

module.exports = {
  getAdoptantes
};