-- CreateTable
CREATE TABLE "Animal" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "especie" TEXT NOT NULL,
    "raza" TEXT,
    "edad" INTEGER NOT NULL,
    "sexo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'DISPONIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adoptante" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adoptante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adopcion" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "adoptanteId" INTEGER NOT NULL,
    "animalId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adopcion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Adoptante_documento_key" ON "Adoptante"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "Adoptante_email_key" ON "Adoptante"("email");

-- AddForeignKey
ALTER TABLE "Adopcion" ADD CONSTRAINT "Adopcion_adoptanteId_fkey" FOREIGN KEY ("adoptanteId") REFERENCES "Adoptante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adopcion" ADD CONSTRAINT "Adopcion_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
