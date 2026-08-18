const adopcionService = require('../services/adopcion.service');

const getAll = async (req, res, next) => {
    try {
        const adopciones = await adopcionService.getAll();
        res.json(adopciones);
    } catch (error) {
        next(error);
    }
};

const getById = async (req, res, next) => {
    try {
        const adopcion = await adopcionService.getById(Number(req.params.id));
        res.json(adopcion);
    } catch (error) {
        next(error);
    }
};

const create = async (req, res, next) => {
    try {
        const adopcion = await adopcionService.create(req.body);
        res.status(201).json(adopcion);
    } catch (error) {
        next(error);
    }
};

const update = async (req, res, next) => {
    try {
        const adopcion = await adopcionService.update(
            Number(req.params.id),
            req.body
        );
        res.json(adopcion);
    } catch (error) {
        next(error);
    }
};

const remove = async (req, res, next) => {
    try {
        await adopcionService.remove(Number(req.params.id));
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