const prisma = require('../config/database');

const queryAdopciones = async (req, res, next) => {
  try {
    const { estado, animalId, adoptanteId } = req.body || {};

    const where = {};

    if (estado) where.estado = estado;
    if (animalId) where.animalId = Number(animalId);
    if (adoptanteId) where.adoptanteId = Number(adoptanteId);

    const adopciones = await prisma.adopcion.findMany({
      where,
      include: {
        animal: true,
        adoptante: true
      }
    });

    res.status(200).json(adopciones);
  } catch (error) {
    next(error);
  }
};

module.exports = { queryAdopciones };