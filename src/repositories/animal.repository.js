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

const findRandom = async () => {
  const animals = await prisma.animal.findMany();

  if (animals.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * animals.length);
  return animals[randomIndex];
};

module.exports = {
  findAll,
  findById,
  findRandom,
  create,
  update,
  remove
};