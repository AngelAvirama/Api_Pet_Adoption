const {
  queryAdopciones
} = require('../src/controllers/adopcion.query.controller');

const prisma = require('../src/config/database');

jest.mock('../src/config/database', () => ({
  adopcion: {
    findMany: jest.fn()
  }
}));

describe('Adopcion Query Controller', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    next = jest.fn();
  });

  test('should return all adoptions without filters', async () => {
    prisma.adopcion.findMany.mockResolvedValue([]);

    await queryAdopciones(req, res, next);

    expect(prisma.adopcion.findMany).toHaveBeenCalledWith({
      where: {},
      include: {
        animal: true,
        adoptante: true
      }
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('should filter by estado', async () => {
    req.body = {
      estado: 'APROBADA'
    };

    prisma.adopcion.findMany.mockResolvedValue([]);

    await queryAdopciones(req, res, next);

    expect(prisma.adopcion.findMany).toHaveBeenCalledWith({
      where: {
        estado: 'APROBADA'
      },
      include: {
        animal: true,
        adoptante: true
      }
    });
  });

  test('should filter by animalId', async () => {
    req.body = {
      animalId: '1'
    };

    prisma.adopcion.findMany.mockResolvedValue([]);

    await queryAdopciones(req, res, next);

    expect(prisma.adopcion.findMany).toHaveBeenCalledWith({
      where: {
        animalId: 1
      },
      include: {
        animal: true,
        adoptante: true
      }
    });
  });

  test('should filter by adoptanteId', async () => {
    req.body = {
      adoptanteId: '2'
    };

    prisma.adopcion.findMany.mockResolvedValue([]);

    await queryAdopciones(req, res, next);

    expect(prisma.adopcion.findMany).toHaveBeenCalledWith({
      where: {
        adoptanteId: 2
      },
      include: {
        animal: true,
        adoptante: true
      }
    });
  });

  test('should apply all filters', async () => {
    req.body = {
      estado: 'APROBADA',
      animalId: '1',
      adoptanteId: '2'
    };

    prisma.adopcion.findMany.mockResolvedValue([]);

    await queryAdopciones(req, res, next);

    expect(prisma.adopcion.findMany).toHaveBeenCalledWith({
      where: {
        estado: 'APROBADA',
        animalId: 1,
        adoptanteId: 2
      },
      include: {
        animal: true,
        adoptante: true
      }
    });
  });

  test('should call next when database fails', async () => {
    const error = new Error('Database error');

    prisma.adopcion.findMany.mockRejectedValue(error);

    await queryAdopciones(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});