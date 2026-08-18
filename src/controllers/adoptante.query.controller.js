const prisma = require('../config/database');

const queryAdoptantes = async (req, res, next) => {
  try {
    const { nombre, apellido, documento, email } = req.body || {};

    const where = {};

    if (nombre) where.nombre = nombre;
    if (apellido) where.apellido = apellido;
    if (documento) where.documento = documento;
    if (email) where.email = email;

    const adoptantes = await prisma.adoptante.findMany({
      where
    });

    res.status(200).json(adoptantes);
  } catch (error) {
    next(error);
  }
};

module.exports = { queryAdoptantes };