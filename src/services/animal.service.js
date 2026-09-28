const animalRepository = require('../repositories/animal.repository');

const getAll = () => {
  return animalRepository.findAll();
};

const getById = async (id) => {
  const animal = await animalRepository.findById(id);

  if (!animal) {
    const error = new Error('Animal not found');
    error.status = 404;
    throw error;
  }

  return animal;
};

const create = (data) => {
  return animalRepository.create(data);
};

const update = async (id, data) => {
  await getById(id);
  return animalRepository.update(id, data);
};

const remove = async (id) => {
  await getById(id);
  return animalRepository.remove(id);
};

const getRandom = () => {
  return animalRepository.findRandom();
};

module.exports = {
  getAll,
  getById,
  getRandom,
  create,
  update,
  remove
};