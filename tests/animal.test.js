const request = require('supertest');

const app = require('../src/app');
const prisma = require('../src/config/database');

describe('Animal API', () => {
  let animalId;

  const animal = {
    nombre: 'Test Animal',
    especie: 'Perro',
    raza: 'Labrador',
    edad: 3,
    sexo: 'Macho',
    estado: 'DISPONIBLE'
  };

  afterAll(async () => {
    if (animalId) {
      await prisma.animal.deleteMany({
        where: {
          id: animalId
        }
      });
    }

    await prisma.$disconnect();
  });

  test('POST /api/animals - should create an animal', async () => {
    const response = await request(app)
      .post('/api/animals')
      .send(animal);

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('id');

    animalId = response.body.id;
  });

  test('POST /api/animals - should reject invalid data', async () => {
    const response = await request(app)
      .post('/api/animals')
      .send({
        nombre: '',
        especie: 'Caballo',
        edad: -5
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.details.length).toBeGreaterThan(0);
  });

  test('GET /api/animals - should return animals', async () => {
    const response = await request(app)
      .get('/api/animals');

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('GET /api/animals/:id - should return an animal', async () => {
    const response = await request(app)
      .get(`/api/animals/${animalId}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.id).toBe(animalId);
  });

  test('GET /api/animals/:id - should return 404 for nonexistent animal', async () => {
    const response = await request(app)
      .get('/api/animals/999999');

    expect(response.statusCode).toBe(404);
  });

  test('PUT /api/animals/:id - should update an animal', async () => {
    const response = await request(app)
      .put(`/api/animals/${animalId}`)
      .send({
        nombre: 'Updated Animal',
        especie: 'Perro',
        raza: 'Golden Retriever',
        edad: 4,
        sexo: 'Macho',
        estado: 'DISPONIBLE'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.nombre).toBe('Updated Animal');
  });

  test('PATCH /api/animals/:id - should partially update an animal', async () => {
    const response = await request(app)
      .patch(`/api/animals/${animalId}`)
      .send({
        nombre: 'Patched Animal'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.nombre).toBe('Patched Animal');
  });

  test('DELETE /api/animals/:id - should delete an animal', async () => {
    const response = await request(app)
      .delete(`/api/animals/${animalId}`);

    expect([200, 204]).toContain(response.statusCode);

    animalId = null;
  });

  test('QUERY /api/animals - should filter animals', async () => {
    const created = await request(app)
      .post('/api/animals')
      .send(animal);

    expect(created.statusCode).toBe(201);

    animalId = created.body.id;

    const response = await request(app)
      .query('/api/animals')
      .send({
        especie: 'Perro',
        estado: 'DISPONIBLE'
      });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});