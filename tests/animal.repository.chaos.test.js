jest.mock('../src/config/database', () => ({
  animal: { findMany: jest.fn() }
}));

const prisma = require('../src/config/database');
const chaos = require('../src/chaos');
const animalRepository = require('../src/repositories/animal.repository');

describe('animal repository under the chaos switch', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));

  afterEach(async () => {
    await chaos.store.clear();
    chaos.cache.invalidate();
    jest.restoreAllMocks();
  });

  test('findRandom reads the database when no fault is active', async () => {
    prisma.animal.findMany.mockResolvedValue([{ id: 1 }]);
    await expect(animalRepository.findRandom()).resolves.toEqual({ id: 1 });
  });

  test('findRandom returns null when there are no animals', async () => {
    prisma.animal.findMany.mockResolvedValue([]);
    await expect(animalRepository.findRandom()).resolves.toBeNull();
  });

  test('findRandom fails like an unreachable database when the fault is active', async () => {
    await chaos.store.write({ error_rate: 1, latency_ms: 0, expires_at: new Date(Date.now() + 60000).toISOString() });
    chaos.cache.invalidate();

    await expect(animalRepository.findRandom()).rejects.toMatchObject({ code: 'P1001' });
  });
});
