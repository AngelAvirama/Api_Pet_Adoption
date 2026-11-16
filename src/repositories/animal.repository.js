const prisma = require('../config/database');
const { cache } = require('../chaos');
const { createDatabaseFaultInjector } = require('../chaos/inject');

// Blast radius of the experiment: only this query (GET .../animals/random,
// the one the coordinator consumes) passes through the chaos switch.
const injectDatabaseFault = createDatabaseFaultInjector({ cache });

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
  await injectDatabaseFault('animal.findRandom');

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