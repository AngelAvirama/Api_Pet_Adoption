const prisma = require('../config/database');

const findAll = () => {
  return prisma.adopcion.findMany({
    include: {
      animal: true,
      adoptante: true
    }
  });
};

const findById = (id) => {
  return prisma.adopcion.findUnique({
    where: { id },
    include: {
      animal: true,
      adoptante: true
    }
  });
};

const create = (data) => {
  return prisma.adopcion.create({
    data,
    include: {
      animal: true,
      adoptante: true
    }
  });
};

const update = (id, data) => {
  return prisma.adopcion.update({
    where: { id },
    data,
    include: {
      animal: true,
      adoptante: true
    }
  });
};

const remove = (id) => {
  return prisma.adopcion.delete({
    where: { id }
  });
};

const findRandom = async () => {
  const adopciones = await prisma.adopcion.findMany({
    include: {
      animal: true,
      adoptante: true
    }
  });

  if (adopciones.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * adopciones.length);
  return adopciones[randomIndex];
};

module.exports = {
  findAll,
  findById,
  findRandom,
  create,
  update,
  remove
};