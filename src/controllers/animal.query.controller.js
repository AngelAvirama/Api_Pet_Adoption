const prisma = require('../config/database');

const queryAnimals = async (req, res, next) => {
  try {
    const { especie, estado, sexo, raza } = req.body || {};

    const where = {};

    if (especie) where.especie = especie;
    if (estado) where.estado = estado;
    if (sexo) where.sexo = sexo;
    if (raza) where.raza = raza;

    const animals = await prisma.animal.findMany({
      where
    });

    res.status(200).json(animals);
  } catch (error) {
    next(error);
  }
};

module.exports = { queryAnimals };