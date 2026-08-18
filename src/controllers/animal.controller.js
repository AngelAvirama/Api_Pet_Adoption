const animalService = require('../services/animal.service');

const getAll = async (req, res, next) => {
  try {
    const animals = await animalService.getAll();
    res.json(animals);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const animal = await animalService.getById(Number(req.params.id));
    res.json(animal);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const animal = await animalService.create(req.body);
    res.status(201).json(animal);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const animal = await animalService.update(
      Number(req.params.id),
      req.body
    );

    res.json(animal);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await animalService.remove(Number(req.params.id));
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