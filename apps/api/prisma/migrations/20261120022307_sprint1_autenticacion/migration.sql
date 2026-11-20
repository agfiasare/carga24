/*
  Warnings:

  - Added the required column `ambito` to the `sesiones` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AmbitoSesion" AS ENUM ('jugador', 'staff');

-- CreateEnum
CREATE TYPE "NivelSesion" AS ENUM ('pendiente', 'completa');

-- Las sesiones existentes no tienen ámbito: se cierran (solo obliga a volver a ingresar).
DELETE FROM "sesiones";

-- AlterTable
ALTER TABLE "sesiones" ADD COLUMN     "ambito" "AmbitoSesion" NOT NULL,
ADD COLUMN     "nivel" "NivelSesion" NOT NULL DEFAULT 'completa',
ADD COLUMN     "secreto_pendiente" TEXT;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "notas_internas" TEXT;
