const prisma = require('../config/database');

const findAll = () => {
  return prisma.adoptante.findMany();
};

const findById = (id) => {
  return prisma.adoptante.findUnique({
    where: { id }
  });
};

const create = (data) => {
  return prisma.adoptante.create({
    data
  });
};

const update = (id, data) => {
  return prisma.adoptante.update({
    where: { id },
    data
  });
};

const remove = (id) => {
  return prisma.adoptante.delete({
    where: { id }
  });
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove
};