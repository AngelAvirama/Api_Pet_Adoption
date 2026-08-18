const adoptanteService = require('../services/adoptante.service');

const getAll = async (req, res, next) => {
  try {
    const adoptantes = await adoptanteService.getAll();
    res.json(adoptantes);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const adoptante = await adoptanteService.getById(Number(req.params.id));
    res.json(adoptante);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const adoptante = await adoptanteService.create(req.body);
    res.status(201).json(adoptante);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const adoptante = await adoptanteService.update(
      Number(req.params.id),
      req.body
    );
    res.json(adoptante);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await adoptanteService.remove(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove
};