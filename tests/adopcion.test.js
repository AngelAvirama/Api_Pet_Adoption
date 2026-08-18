const request = require('supertest');

const app = require('../src/app');
const prisma = require('../src/config/database');

describe('Adopcion API', () => {
  let animalId;
  let adoptanteId;
  let adopcionId;

  beforeAll(async () => {
    const animal = await request(app)
      .post('/api/animals')
      .send({
        nombre: 'Animal Adopcion Test',
        especie: 'Perro',
        raza: 'Criollo',
        edad: 2,
        sexo: 'Macho',
        estado: 'DISPONIBLE'
      });

    expect(animal.statusCode).toBe(201);

    animalId = animal.body.id;

    const adoptante = await request(app)
      .post('/api/adoptantes')
      .send({
        nombre: 'Adopcion',
        apellido: 'Test',
        documento: 'ADOP-TEST-001',
        telefono: '3000000001',
        email: 'adopcion.test@example.com',
        direccion: 'Medellin'
      });

    expect(adoptante.statusCode).toBe(201);

    adoptanteId = adoptante.body.id;
  });

  afterAll(async () => {
    if (adopcionId) {
      await prisma.adopcion.deleteMany({
        where: { id: adopcionId }
      });
    }

    if (animalId) {
      await prisma.animal.deleteMany({
        where: { id: animalId }
      });
    }

    if (adoptanteId) {
      await prisma.adoptante.deleteMany({
        where: { id: adoptanteId }
      });
    }

    await prisma.$disconnect();
  });

  test('POST /api/adopciones - should create an adoption', async () => {
    const response = await request(app)
      .post('/api/adopciones')
      .send({
        animalId,
        adoptanteId,
        estado: 'PENDIENTE'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('id');

    adopcionId = response.body.id;
  });

  test('POST /api/adopciones - should reject invalid data', async () => {
    const response = await request(app)
      .post('/api/adopciones')
      .send({
        animalId: -1,
        adoptanteId: -1
      });

    expect(response.statusCode).toBe(400);
  });

  test('GET /api/adopciones - should return adoptions', async () => {
    const response = await request(app)
      .get('/api/adopciones');

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('GET /api/adopciones/:id - should return an adoption', async () => {
    const response = await request(app)
      .get(`/api/adopciones/${adopcionId}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.id).toBe(adopcionId);
  });

  test('GET /api/adopciones/:id - should return 404', async () => {
    const response = await request(app)
      .get('/api/adopciones/999999');

    expect(response.statusCode).toBe(404);
  });

  test('PUT /api/adopciones/:id - should update adoption', async () => {
    const response = await request(app)
      .put(`/api/adopciones/${adopcionId}`)
      .send({
        animalId,
        adoptanteId,
        estado: 'APROBADA'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.estado).toBe('APROBADA');
  });

  test('PATCH /api/adopciones/:id - should partially update', async () => {
    const response = await request(app)
      .patch(`/api/adopciones/${adopcionId}`)
      .send({
        estado: 'CANCELADA'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.estado).toBe('CANCELADA');
  });

  test('DELETE /api/adopciones/:id - should delete adoption', async () => {
    const response = await request(app)
      .delete(`/api/adopciones/${adopcionId}`);

    expect([200, 204]).toContain(response.statusCode);

    adopcionId = null;
  });
});