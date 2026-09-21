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

module.exports = {
  getAdopciones
};