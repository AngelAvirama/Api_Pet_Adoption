const adopcionRepository = require('../repositories/adopcion.repository');
const animalRepository = require('../repositories/animal.repository');
const adoptanteRepository = require('../repositories/adoptante.repository');

const getAll = () => {
  return adopcionRepository.findAll();
};

const getById = async (id) => {
  const adopcion = await adopcionRepository.findById(id);

  if (!adopcion) {
    const error = new Error('Adopcion not found');
    error.status = 404;
    throw error;
  }

  return adopcion;
};

const create = async (data) => {
  const animal = await animalRepository.findById(data.animalId);

  if (!animal) {
    const error = new Error('Animal not found');
    error.status = 404;
    throw error;
  }

  const adoptante = await adoptanteRepository.findById(data.adoptanteId);

  if (!adoptante) {
    const error = new Error('Adoptante not found');
    error.status = 404;
    throw error;
  }

  if (animal.estado !== 'DISPONIBLE') {
    const error = new Error('Animal is not available for adoption');
    error.status = 409;
    throw error;
  }

  const adopcion = await adopcionRepository.create({
    animalId: data.animalId,
    adoptanteId: data.adoptanteId,
    estado: 'APROBADA'
  });

  await animalRepository.update(data.animalId, {
    estado: 'ADOPTADO'
  });

  return adopcion;
};

const update = async (id, data) => {
  await getById(id);

  return adopcionRepository.update(id, data);
};

const remove = async (id) => {
  await getById(id);

  return adopcionRepository.remove(id);
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove
};