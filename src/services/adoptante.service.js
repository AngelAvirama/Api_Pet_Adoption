const adoptanteRepository = require('../repositories/adoptante.repository');

const getAll = () => {
  return adoptanteRepository.findAll();
};

const getById = async (id) => {
  const adoptante = await adoptanteRepository.findById(id);

  if (!adoptante) {
    const error = new Error('Adoptante not found');
    error.status = 404;
    throw error;
  }

  return adoptante;
};

const create = (data) => {
  return adoptanteRepository.create(data);
};

const update = async (id, data) => {
  await getById(id);
  return adoptanteRepository.update(id, data);
};

const remove = async (id) => {
  await getById(id);
  return adoptanteRepository.remove(id);
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove
};