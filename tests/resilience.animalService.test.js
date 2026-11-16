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
