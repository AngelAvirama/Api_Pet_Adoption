
const prisma = require('../src/config/database');

async function main() {
  const animales = [
    {
      nombre: 'Max',
      especie: 'Perro',
      raza: 'Labrador',
      edad: 3,
      sexo: 'Macho',
      estado: 'DISPONIBLE',
    },
    {
      nombre: 'Luna',
      especie: 'Gato',
      raza: 'Criollo',
      edad: 2,
      sexo: 'Hembra',
      estado: 'DISPONIBLE',
    },
  ];

  for (const animal of animales) {
    const existente = await prisma.animal.findFirst({
      where: {
        nombre: animal.nombre,
        especie: animal.especie,
        raza: animal.raza,
      },
    });

    if (!existente) {
      await prisma.animal.create({ data: animal });
      console.log(`Animal creado: ${animal.nombre}`);
    } else {
      console.log(`Animal ya existente: ${animal.nombre}`);
    }
  }

  const adoptantes = [
    {
      nombre: 'Carlos',
      apellido: 'Gomez',
      documento: '100000001',
      telefono: '3000000001',
      email: 'carlos@example.com',
      direccion: 'Medellin',
    },
    {
      nombre: 'Laura',
      apellido: 'Perez',
      documento: '100000002',
      telefono: '3000000002',
      email: 'laura@example.com',
      direccion: 'Medellin',
    },
  ];

  for (const adoptante of adoptantes) {
    const existente = await prisma.adoptante.findUnique({
      where: { documento: adoptante.documento },
    });

    if (!existente) {
      await prisma.adoptante.create({ data: adoptante });
      console.log(`Adoptante creado: ${adoptante.nombre}`);
    } else {
      console.log(`Adoptante ya existente: ${adoptante.nombre}`);
    }
  }

  const [totalAnimales, totalAdoptantes, totalAdopciones] =
    await Promise.all([
      prisma.animal.count(),
      prisma.adoptante.count(),
      prisma.adopcion.count(),
    ]);

  console.log('Resumen de la base de datos:');
  console.log({
    animales: totalAnimales,
    adoptantes: totalAdoptantes,
    adopciones: totalAdopciones,
  });
}

main()
  .catch((error) => {
    console.error('Error al ejecutar el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
