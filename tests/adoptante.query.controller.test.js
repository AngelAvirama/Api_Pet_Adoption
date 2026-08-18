const { queryAdoptantes } = require('../src/controllers/adoptante.query.controller');

const prisma = require('../src/config/database');

jest.mock('../src/config/database', () => ({
  adoptante: {
    findMany: jest.fn()
  }
}));

describe('Adoptante Query Controller', () => {
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

  test('should return all adoptantes without filters', async () => {
    prisma.adoptante.findMany.mockResolvedValue([
      {
        id: 1,
        nombre: 'Angel',
        apellido: 'Test'
      }
    ]);

    await queryAdoptantes(req, res, next);

    expect(prisma.adoptante.findMany).toHaveBeenCalledWith({
      where: {}
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('should filter by nombre', async () => {
    req.body = {
      nombre: 'Angel'
    };

    prisma.adoptante.findMany.mockResolvedValue([]);

    await queryAdoptantes(req, res, next);

    expect(prisma.adoptante.findMany).toHaveBeenCalledWith({
      where: {
        nombre: 'Angel'
      }
    });
  });

  test('should filter by apellido', async () => {
    req.body = {
      apellido: 'Perez'
    };

    prisma.adoptante.findMany.mockResolvedValue([]);

    await queryAdoptantes(req, res, next);

    expect(prisma.adoptante.findMany).toHaveBeenCalledWith({
      where: {
        apellido: 'Perez'
      }
    });
  });

  test('should filter by documento', async () => {
    req.body = {
      documento: '123456789'
    };

    prisma.adoptante.findMany.mockResolvedValue([]);

    await queryAdoptantes(req, res, next);

    expect(prisma.adoptante.findMany).toHaveBeenCalledWith({
      where: {
        documento: '123456789'
      }
    });
  });

  test('should filter by email', async () => {
    req.body = {
      email: 'test@example.com'
    };

    prisma.adoptante.findMany.mockResolvedValue([]);

    await queryAdoptantes(req, res, next);

    expect(prisma.adoptante.findMany).toHaveBeenCalledWith({
      where: {
        email: 'test@example.com'
      }
    });
  });

  test('should apply multiple filters', async () => {
    req.body = {
      nombre: 'Angel',
      apellido: 'Perez',
      documento: '123456789',
      email: 'test@example.com'
    };

    prisma.adoptante.findMany.mockResolvedValue([]);

    await queryAdoptantes(req, res, next);

    expect(prisma.adoptante.findMany).toHaveBeenCalledWith({
      where: {
        nombre: 'Angel',
        apellido: 'Perez',
        documento: '123456789',
        email: 'test@example.com'
      }
    });
  });

  test('should call next when database fails', async () => {
    const error = new Error('Database error');

    prisma.adoptante.findMany.mockRejectedValue(error);

    await queryAdoptantes(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});