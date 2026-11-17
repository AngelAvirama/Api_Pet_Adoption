const { createAnimalController } = require('../src/v5/controllers/animal.controller');
const { DependencyUnavailableError } = require('../src/resilience/animalService');

jest.mock('../src/config/database', () => ({}));

const buildRes = () => {
  const res = { headers: {} };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.setHeader = jest.fn((k, v) => { res.headers[k] = v; });
  return res;
};

describe('v5 animal controller', () => {
  test('answers 503 with Retry-After when the dependency is unavailable', async () => {
    const controller = createAnimalController({
      service: { getRandom: jest.fn().mockRejectedValue(new DependencyUnavailableError('circuito_abierto')) }
    });
    const res = buildRes();

    await controller.getRandomAnimal({ traceId: 't-1' }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.headers['Retry-After']).toBe('5');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ motivo: 'circuito_abierto', traceId: 't-1' }));
  });

  test('answers 200 marked as degraded with the last known animal', async () => {
    const controller = createAnimalController({
      service: { getRandom: jest.fn().mockResolvedValue({ animal: { id: 3 }, degradado: true, motivo: 'timeout' }) }
    });
    const res = buildRes();

    await controller.getRandomAnimal({ traceId: 't-2' }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.headers['X-Degradado']).toBe('true');
    expect(res.json).toHaveBeenCalledWith({ data: { id: 3 }, traceId: 't-2', degradado: true, motivo: 'timeout' });
  });

  test('passes unexpected errors to the error handler', async () => {
    const next = jest.fn();
    const controller = createAnimalController({ service: { getRandom: jest.fn().mockRejectedValue(new Error('x')) } });

    await controller.getRandomAnimal({}, buildRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
