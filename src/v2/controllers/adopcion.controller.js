const adopcionService = require('../../services/adopcion.service');

const getAdopciones = async (req, res, next) => {
  try {
    const adopciones = await adopcionService.getAll();

    res.status(200).json({
      data: adopciones,
      traceId: req.traceId
    });
  } catch (error) {
    next(error);
  }
};

const getRandomAdopcion = async (req, res, next) => {
  try {
    const adopcion = await adopcionService.getRandom();

    if (!adopcion) {
      return res.status(404).json({
        error: 'No adoptions found',
        traceId: req.traceId
      });
    }

    res.status(200).json({
      data: adopcion,
      traceId: req.traceId
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdopciones,
  getRandomAdopcion
};