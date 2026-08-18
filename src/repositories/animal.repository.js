const prisma = require('../config/database');

const findAll = () => {
  return prisma.animal.findMany();
};

const findById = (id) => {
  return prisma.animal.findUnique({
    where: { id }
  });
};

const create = (data) => {
  return prisma.animal.create({
    data
  });
};

const update = (id, data) => {
  return prisma.animal.update({
    where: { id },
    data
  });
};

const remove = (id) => {
  return prisma.animal.delete({
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