const adopcionService = require('../src/services/adopcion.service');

const adopcionRepository = require('../src/repositories/adopcion.repository');
const animalRepository = require('../src/repositories/animal.repository');
const adoptanteRepository = require('../src/repositories/adoptante.repository');

jest.mock('../src/repositories/adopcion.repository');
jest.mock('../src/repositories/animal.repository');
jest.mock('../src/repositories/adoptante.repository');

describe('Adopcion Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getAll should return all adoptions', async () => {
    const adoptions = [
      {
        id: 1,
        estado: 'APROBADA'
      }
    ];

    adopcionRepository.findAll.mockResolvedValue(adoptions);

    const result = await adopcionService.getAll();

    expect(result).toEqual(adoptions);
    expect(adopcionRepository.findAll).toHaveBeenCalled();
  });

  test('getById should return an adoption', async () => {
    const adoption = {
      id: 1,
      estado: 'APROBADA'
    };

    adopcionRepository.findById.mockResolvedValue(adoption);

    const result = await adopcionService.getById(1);

    expect(result).toEqual(adoption);
  });

  test('getById should throw 404 when adoption does not exist', async () => {
    adopcionRepository.findById.mockResolvedValue(null);

    await expect(
      adopcionService.getById(999)
    ).rejects.toMatchObject({
      status: 404,
      message: 'Adopcion not found'
    });
  });

  test('create should throw 404 when animal does not exist', async () => {
    animalRepository.findById.mockResolvedValue(null);

    await expect(
      adopcionService.create({
        animalId: 999,
        adoptanteId: 1
      })
    ).rejects.toMatchObject({
      status: 404,
      message: 'Animal not found'
    });

    expect(adoptanteRepository.findById).not.toHaveBeenCalled();
  });

  test('create should throw 404 when adoptante does not exist', async () => {
    animalRepository.findById.mockResolvedValue({
      id: 1,
      estado: 'DISPONIBLE'
    });

    adoptanteRepository.findById.mockResolvedValue(null);

    await expect(
      adopcionService.create({
        animalId: 1,
        adoptanteId: 999
      })
    ).rejects.toMatchObject({
      status: 404,
      message: 'Adoptante not found'
    });
  });

  test('create should throw 409 when animal is not available', async () => {
    animalRepository.findById.mockResolvedValue({
      id: 1,
      estado: 'ADOPTADO'
    });

    adoptanteRepository.findById.mockResolvedValue({
      id: 1
    });

    await expect(
      adopcionService.create({
        animalId: 1,
        adoptanteId: 1
      })
    ).rejects.toMatchObject({
      status: 409,
      message: 'Animal is not available for adoption'
    });
  });

  test('create should create adoption and update animal', async () => {
    const adoption = {
      id: 1,
      animalId: 1,
      adoptanteId: 1,
      estado: 'APROBADA'
    };

    animalRepository.findById.mockResolvedValue({
      id: 1,
      estado: 'DISPONIBLE'
    });

    adoptanteRepository.findById.mockResolvedValue({
      id: 1
    });

    adopcionRepository.create.mockResolvedValue(adoption);

    animalRepository.update.mockResolvedValue({
      id: 1,
      estado: 'ADOPTADO'
    });

    const result = await adopcionService.create({
      animalId: 1,
      adoptanteId: 1
    });

    expect(result).toEqual(adoption);

    expect(adopcionRepository.create).toHaveBeenCalledWith({
      animalId: 1,
      adoptanteId: 1,
      estado: 'APROBADA'
    });

    expect(animalRepository.update).toHaveBeenCalledWith(
      1,
      {
        estado: 'ADOPTADO'
      }
    );
  });

  test('update should update an existing adoption', async () => {
    const adoption = {
      id: 1,
      estado: 'PENDIENTE'
    };

    adopcionRepository.findById.mockResolvedValue(adoption);

    adopcionRepository.update.mockResolvedValue({
      ...adoption,
      estado: 'APROBADA'
    });

    const result = await adopcionService.update(1, {
      estado: 'APROBADA'
    });

    expect(result.estado).toBe('APROBADA');

    expect(adopcionRepository.update).toHaveBeenCalledWith(
      1,
      {
        estado: 'APROBADA'
      }
    );
  });

  test('update should throw 404 when adoption does not exist', async () => {
    adopcionRepository.findById.mockResolvedValue(null);

    await expect(
      adopcionService.update(999, {
        estado: 'APROBADA'
      })
    ).rejects.toMatchObject({
      status: 404
    });

    expect(adopcionRepository.update).not.toHaveBeenCalled();
  });

  test('remove should remove an existing adoption', async () => {
    const adoption = {
      id: 1
    };

    adopcionRepository.findById.mockResolvedValue(adoption);

    adopcionRepository.remove.mockResolvedValue(adoption);

    const result = await adopcionService.remove(1);

    expect(result).toEqual(adoption);

    expect(adopcionRepository.remove).toHaveBeenCalledWith(1);
  });

  test('remove should throw 404 when adoption does not exist', async () => {
    adopcionRepository.findById.mockResolvedValue(null);

    await expect(
      adopcionService.remove(999)
    ).rejects.toMatchObject({
      status: 404
    });

    expect(adopcionRepository.remove).not.toHaveBeenCalled();
  });
});