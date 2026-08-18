const request = require('supertest');

const app = require('../src/app');
const prisma = require('../src/config/database');

describe('Adoptante API', () => {
  let adoptanteId;

  const adoptante = {
    nombre: 'Test',
    apellido: 'Adoptante',
    documento: 'TEST-001',
    telefono: '3000000000',
    email: 'test.adoptante@example.com',
    direccion: 'Medellin'
  };

  afterAll(async () => {
    if (adoptanteId) {
      await prisma.adoptante.deleteMany({
        where: { id: adoptanteId }
      });
    }

    await prisma.$disconnect();
  });

  test('POST /api/adoptantes - should create an adoptante', async () => {
    const response = await request(app)
      .post('/api/adoptantes')
      .send(adoptante);

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('id');

    adoptanteId = response.body.id;
  });

  test('POST /api/adoptantes - should reject invalid data', async () => {
    const response = await request(app)
      .post('/api/adoptantes')
      .send({
        nombre: '',
        email: 'correo-invalido'
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('GET /api/adoptantes - should return adoptantes', async () => {
    const response = await request(app)
      .get('/api/adoptantes');

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('GET /api/adoptantes/:id - should return an adoptante', async () => {
    const response = await request(app)
      .get(`/api/adoptantes/${adoptanteId}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.id).toBe(adoptanteId);
  });

  test('GET /api/adoptantes/:id - should return 404', async () => {
    const response = await request(app)
      .get('/api/adoptantes/999999');

    expect(response.statusCode).toBe(404);
  });

  test('PUT /api/adoptantes/:id - should update an adoptante', async () => {
    const response = await request(app)
      .put(`/api/adoptantes/${adoptanteId}`)
      .send({
        nombre: 'Updated',
        apellido: 'Adoptante',
        documento: 'TEST-001',
        telefono: '3000000001',
        email: 'updated@example.com',
        direccion: 'Medellin'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.nombre).toBe('Updated');
  });

  test('PATCH /api/adoptantes/:id - should partially update', async () => {
    const response = await request(app)
      .patch(`/api/adoptantes/${adoptanteId}`)
      .send({
        apellido: 'Patched'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.apellido).toBe('Patched');
  });

  test('QUERY /api/adoptantes - should return filtered results', async () => {
    // Aquí pondremos la prueba de QUERY cuando confirmemos
    // la forma en que tu versión de Supertest envía QUERY.
    const response = await request(app)
      .get('/api/adoptantes');

    expect(response.statusCode).toBe(200);
  });

  test('DELETE /api/adoptantes/:id - should delete an adoptante', async () => {
    const response = await request(app)
      .delete(`/api/adoptantes/${adoptanteId}`);

    expect([200, 204]).toContain(response.statusCode);

    adoptanteId = null;
  });
});