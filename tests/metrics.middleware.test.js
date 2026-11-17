process.env.REDIS_ENABLED = 'false';

jest.mock('../src/config/database', () => ({}));
jest.mock('../src/services/animal.service', () => ({ getRandom: jest.fn() }));

const request = require('supertest');
const { routeLabel } = require('../src/middlewares/metrics.middleware');
const { register } = require('../src/config/metrics');
const animalService = require('../src/services/animal.service');
const app = require('../src/app');

const count = async (labels) => {
  const metric = (await register.getMetricsAsJSON()).find((m) => m.name === 'http_requests_total');
  return metric.values
    .filter((v) => Object.entries(labels).every(([k, val]) => v.labels[k] === val))
    .reduce((sum, v) => sum + v.value, 0);
};

describe('route label of the HTTP metrics', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  test('keeps the /api/v2 prefix when the request ends in the error handler', async () => {
    animalService.getRandom.mockRejectedValue(Object.assign(new Error('down'), { code: 'P1001' }));

    const res = await request(app).get('/api/v2/animals/random');

    expect(res.status).toBe(500);
    expect(await count({ route: '/api/v2/animals/random', status_code: '500' })).toBe(1);
    expect(await count({ route: '/animals/random' })).toBe(0);
  });

  test('builds the template from the url and the matched route', () => {
    expect(routeLabel({ originalUrl: '/api/v4/animals/7?x=1', route: { path: '/animals/:id' } })).toBe('/api/v4/animals/:id');
    expect(routeLabel({ originalUrl: '/api/v2/animals/random', route: { path: '/animals/random' } })).toBe('/api/v2/animals/random');
    expect(routeLabel({ originalUrl: '/api/animals', route: { path: '/' } })).toBe('/api/animals');
    expect(routeLabel({ originalUrl: '/no/existe' })).toBe('/no/existe');
    expect(routeLabel({ url: '/x', route: { path: /regex/ } })).toBe('/x');
  });
});
