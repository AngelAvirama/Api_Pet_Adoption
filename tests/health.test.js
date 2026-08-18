const request = require('supertest');

const app = require('../src/app');

describe('Health Check', () => {
  test('GET / should return API status', async () => {
    const response = await request(app)
      .get('/');

    expect(response.statusCode).toBe(200);

    expect(response.body).toEqual({
      message: 'Pet Adoption API is running'
    });
  });
});