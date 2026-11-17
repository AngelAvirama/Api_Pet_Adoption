// In-memory stand-in for Prisma, loaded with `node -r`. It lets the API run
// without PostgreSQL (local rounds of the experiment, CI smoke tests). It
// only covers what the experiment touches: reading animals.
//
//   node -r ./chaos/mocks/fake-database.js src/server.js
//
// FAKE_DB_LATENCY_MS simulates the round trip to RDS (default 15 ms).
const Module = require('module');
const path = require('path');

const DATABASE_MODULE = path.resolve(__dirname, '../../src/config/database.js');
const latencyMs = Number(process.env.FAKE_DB_LATENCY_MS || 15);

const animals = [
  { id: 1, nombre: 'Luna', especie: 'Perro', raza: 'Criollo', edad: 3, sexo: 'Hembra', estado: 'DISPONIBLE' },
  { id: 2, nombre: 'Max', especie: 'Perro', raza: 'Labrador', edad: 5, sexo: 'Macho', estado: 'DISPONIBLE' },
  { id: 3, nombre: 'Michi', especie: 'Gato', raza: 'Siames', edad: 2, sexo: 'Hembra', estado: 'DISPONIBLE' },
  { id: 4, nombre: 'Rocky', especie: 'Perro', raza: 'Pastor', edad: 7, sexo: 'Macho', estado: 'ADOPTADO' },
  { id: 5, nombre: 'Nala', especie: 'Gato', raza: 'Criollo', edad: 1, sexo: 'Hembra', estado: 'DISPONIBLE' }
].map((animal) => ({ ...animal, createdAt: new Date('2026-11-01'), updatedAt: new Date('2026-11-01') }));

const delay = () => new Promise((resolve) => setTimeout(resolve, latencyMs));

const fakePrisma = {
  animal: {
    findMany: async () => {
      await delay();
      return animals.map((animal) => ({ ...animal }));
    },
    findUnique: async ({ where }) => {
      await delay();
      return animals.find((animal) => animal.id === where.id) || null;
    }
  },
  $disconnect: async () => {}
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (parent && Module._resolveFilename(request, parent) === DATABASE_MODULE) {
    return fakePrisma;
  }
  return originalLoad.call(this, request, parent, isMain);
};

console.log('[fake-database] Prisma replaced by an in-memory database for local chaos rounds');
