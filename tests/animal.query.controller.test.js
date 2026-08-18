const { queryAnimals } = require('../src/controllers/animal.query.controller');

const prisma = require('../src/config/database');

jest.mock('../src/config/database', () => ({
  animal: {
    findMany: jest.fn()
  }
}));

describe('Animal Query Controller', () => {
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

  test('should return all animals without filters', async () => {
    prisma.animal.findMany.mockResolvedValue([
      {
        id: 1,
        especie: 'Perro',
        estado: 'Disponible',
        sexo: 'Macho',
        raza: 'Labrador'
      }
    ]);

    await queryAnimals(req, res, next);

    expect(prisma.animal.findMany).toHaveBeenCalledWith({
      where: {}
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('should filter by especie', async () => {
    req.body = {
      especie: 'Perro'
    };

    prisma.animal.findMany.mockResolvedValue([]);

    await queryAnimals(req, res, next);

    expect(prisma.animal.findMany).toHaveBeenCalledWith({
      where: {
        especie: 'Perro'
      }
    });
  });

  test('should filter by estado', async () => {
    req.body = {
      estado: 'Disponible'
    };

    prisma.animal.findMany.mockResolvedValue([]);

    await queryAnimals(req, res, next);

    expect(prisma.animal.findMany).toHaveBeenCalledWith({
      where: {
        estado: 'Disponible'
      }
    });
  });

  test('should filter by sexo', async () => {
    req.body = {
      sexo: 'Macho'
    };

    prisma.animal.findMany.mockResolvedValue([]);

    await queryAnimals(req, res, next);

    expect(prisma.animal.findMany).toHaveBeenCalledWith({
      where: {
        sexo: 'Macho'
      }
    });
  });

  test('should filter by raza', async () => {
    req.body = {
      raza: 'Labrador'
    };

    prisma.animal.findMany.mockResolvedValue([]);

    await queryAnimals(req, res, next);

    expect(prisma.animal.findMany).toHaveBeenCalledWith({
      where: {
        raza: 'Labrador'
      }
    });
  });

  test('should apply multiple filters', async () => {
    req.body = {
      especie: 'Perro',
      estado: 'Disponible',
      sexo: 'Macho',
      raza: 'Labrador'
    };

    prisma.animal.findMany.mockResolvedValue([]);

    await queryAnimals(req, res, next);

    expect(prisma.animal.findMany).toHaveBeenCalledWith({
      where: {
        especie: 'Perro',
        estado: 'Disponible',
        sexo: 'Macho',
        raza: 'Labrador'
      }
    });
  });

  test('should call next when database fails', async () => {
    const error = new Error('Database error');

    prisma.animal.findMany.mockRejectedValue(error);

    await queryAnimals(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
