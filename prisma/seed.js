const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const animal1 = await prisma.animal.create({
    data: {
      nombre: 'Max',
      especie: 'Perro',
      raza: 'Labrador',
      edad: 3,
      sexo: 'Macho',
      estado: 'DISPONIBLE'
    }
  });

  const animal2 = await prisma.animal.create({
    data: {
      nombre: 'Luna',
      especie: 'Gato',
      raza: 'Criollo',
      edad: 2,
      sexo: 'Hembra',
      estado: 'DISPONIBLE'
    }
  });

  await prisma.adoptante.create({
    data: {
      nombre: 'Carlos',
      apellido: 'Gomez',
      documento: '100000001',
      telefono: '3000000001',
      email: 'carlos@example.com',
      direccion: 'Medellin'
    }
  });

  await prisma.adoptante.create({
    data: {
      nombre: 'Laura',
      apellido: 'Perez',
      documento: '100000002',
      telefono: '3000000002',
      email: 'laura@example.com',
      direccion: 'Medellin'
    }
  });

  console.log({ animal1, animal2 });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });