jest.mock('../src/config/database', () => ({}));

jest.mock('../src/services/animal.service', () => ({
  getRandom: jest.fn()
}));

const request = require('supertest');
const app = require('../src/app');
const animalService = require('../src/services/animal.service');

describe('Release 5 contract consumed by the coordinator', () => {
  afterEach(() => jest.clearAllMocks());

  test('GET /api/v2/animals/random returns an animal and echoes the trace id', async () => {
    animalService.getRandom.mockResolvedValue({ id: 1, nombre: 'Luna' });

    const res = await request(app)
      .get('/api/v2/animals/random')
      .set('X-Trace-Id', 'prueba-angel-0001');

    expect(res.status).toBe(200);
    expect(res.headers['x-trace-id']).toBe('prueba-angel-0001');
    expect(res.body).toEqual({
      data: { id: 1, nombre: 'Luna' },
      traceId: 'prueba-angel-0001'
    });
  });

  test('GET /api/v5/animals/random answers the same contract', async () => {
    animalService.getRandom.mockResolvedValue({ id: 2, nombre: 'Max' });

    const res = await request(app).get('/api/v5/animals/random');

    expect(res.status).toBe(200);
    expect(res.body.data.nombre).toBe('Max');
  });

  test('returns 404 when there are no animals', async () => {
    animalService.getRandom.mockResolvedValue(null);

    const res = await request(app).get('/api/v2/animals/random');

    expect(res.status).toBe(404);
  });

  test('returns 500 when the database fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    animalService.getRandom.mockRejectedValue(new Error('db down'));

    const res = await request(app).get('/api/v2/animals/random');

    expect(res.status).toBe(500);
  });

  test('GET /api/v2/health reports the contract version', async () => {
    const res = await request(app)
      .get('/api/v2/health')
      .set('X-Trace-Id', 'salud-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', version: 'v2', traceId: 'salud-1' });
  });
});
