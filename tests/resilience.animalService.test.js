const { createResilientAnimalService, DependencyUnavailableError } = require('../src/resilience/animalService');
const { resilienceConfig } = require('../src/resilience/config');

const fastConfig = (enabled) => ({
  ...resilienceConfig({}),
  enabled,
  timeoutMs: 50,
  breaker: { errorThresholdPercentage: 50, volumeThreshold: 2, resetTimeout: 1000, rollingCountTimeout: 1000 }
});

const failingDb = () => {
  const error = new Error("Can't reach database server");
  error.code = 'P1001';
  return { getRandom: jest.fn().mockRejectedValue(error) };
};

describe('resilient animal service', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  test('round 0 calls the database directly and lets the error through', async () => {
    const service = failingDb();
    const resilient = createResilientAnimalService({ service, config: fastConfig(false) });

    await expect(resilient.getRandom()).rejects.toMatchObject({ code: 'P1001' });
    expect(resilient.breakerState()).toBe('disabled');
  });

  test('round 0 returns the animal when the database answers', async () => {
    const resilient = createResilientAnimalService({
      service: { getRandom: jest.fn().mockResolvedValue({ id: 1 }) },
      config: fastConfig(false)
    });
    await expect(resilient.getRandom()).resolves.toEqual({ animal: { id: 1 }, degradado: false });
  });

  test('round 1 turns database failures into a fast 503 and opens the circuit', async () => {
    const onBreakerState = jest.fn();
    const service = failingDb();
    const resilient = createResilientAnimalService({ service, config: fastConfig(true), onBreakerState });

    const first = await resilient.getRandom().catch((e) => e);
    expect(first).toBeInstanceOf(DependencyUnavailableError);
    expect(first).toMatchObject({ status: 503, motivo: 'error_base_de_datos' });

    await resilient.getRandom().catch(() => {});
    const third = await resilient.getRandom().catch((e) => e);
    expect(third.motivo).toBe('circuito_abierto');
    expect(resilient.breakerState()).toBe('open');
    expect(service.getRandom).toHaveBeenCalledTimes(2);
    expect(onBreakerState).toHaveBeenCalledWith('database_animals', 2);
    resilient.shutdown();
  });
});

describe('graceful degradation with the last known animal', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  test('serves a last known animal marked as degraded when the database fails', async () => {
    const onDegraded = jest.fn();
    const service = { getRandom: jest.fn().mockResolvedValueOnce({ id: 7, nombre: 'Kira' }) };
    const resilient = createResilientAnimalService({ service, config: fastConfig(true), onDegraded });

    await expect(resilient.getRandom()).resolves.toEqual({ animal: { id: 7, nombre: 'Kira' }, degradado: false });

    service.getRandom.mockRejectedValue(Object.assign(new Error('down'), { code: 'P1001' }));
    const degraded = await resilient.getRandom();

    expect(degraded).toEqual({ animal: { id: 7, nombre: 'Kira' }, degradado: true, motivo: 'error_base_de_datos' });
    expect(onDegraded).toHaveBeenCalledWith('error_base_de_datos');
    resilient.shutdown();
  });

  test('warmUp fills the fallback from the database and survives a failure', async () => {
    const service = {
      getRandom: jest.fn().mockRejectedValue(new Error('down')),
      getAll: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }])
    };
    const resilient = createResilientAnimalService({ service, config: fastConfig(true) });

    expect(await resilient.warmUp()).toBe(2);
    expect((await resilient.getRandom()).degradado).toBe(true);

    service.getAll.mockRejectedValue(new Error('down'));
    expect(await resilient.warmUp()).toBe(2);
    resilient.shutdown();
  });

  test('warmUp does nothing in round 0', async () => {
    const resilient = createResilientAnimalService({ service: { getAll: jest.fn() }, config: fastConfig(false) });
    expect(await resilient.warmUp()).toBe(0);
    expect(resilient.shutdown()).toBe(null);
  });
});
