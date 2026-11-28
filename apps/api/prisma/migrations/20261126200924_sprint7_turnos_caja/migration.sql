-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('cierre_turno', 'liquidacion', 'ajuste');

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "turno_id" TEXT;

-- CreateTable
CREATE TABLE "turnos" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "abierto_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caja_al_abrir" INTEGER NOT NULL DEFAULT 0,
    "cerrado_en" TIMESTAMP(3),
    "cerrado_por_id" TEXT,
    "cantidad_cargas" INTEGER NOT NULL DEFAULT 0,
    "cantidad_retiros" INTEGER NOT NULL DEFAULT 0,
    "ingresos" INTEGER NOT NULL DEFAULT 0,
    "comision" INTEGER NOT NULL DEFAULT 0,
    "cargas_netas" INTEGER NOT NULL DEFAULT 0,
    "premios" INTEGER NOT NULL DEFAULT 0,
    "resultado" INTEGER NOT NULL DEFAULT 0,
    "caja_al_cerrar" INTEGER,
    "saldo_informado" INTEGER,
    "nota" TEXT,

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_caja" (
    "id" TEXT NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "monto" INTEGER NOT NULL,
    "saldo_posterior" INTEGER NOT NULL,
    "nota" TEXT,
    "turno_id" TEXT,
    "creado_por_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rendiciones" (
    "id" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "cargas_netas" INTEGER NOT NULL,
    "premios" INTEGER NOT NULL,
    "arrastre" INTEGER NOT NULL DEFAULT 0,
    "correspondia" INTEGER NOT NULL,
    "rendido" INTEGER NOT NULL,
    "nota" TEXT,
    "creado_por_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rendiciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "turnos_abierto_en_idx" ON "turnos"("abierto_en");

-- CreateIndex
CREATE INDEX "turnos_cerrado_en_idx" ON "turnos"("cerrado_en");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_caja_turno_id_key" ON "movimientos_caja"("turno_id");

-- CreateIndex
CREATE INDEX "movimientos_caja_creado_en_idx" ON "movimientos_caja"("creado_en");

-- CreateIndex
CREATE INDEX "rendiciones_creado_en_idx" ON "rendiciones"("creado_en");

-- CreateIndex
CREATE INDEX "pedidos_turno_id_idx" ON "pedidos"("turno_id");

-- CreateIndex
CREATE INDEX "pedidos_ejecutado_en_idx" ON "pedidos"("ejecutado_en");

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_cerrado_por_id_fkey" FOREIGN KEY ("cerrado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendiciones" ADD CONSTRAINT "rendiciones_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Una persona tiene a lo sumo un turno abierto.
CREATE UNIQUE INDEX "turnos_un_abierto_por_usuario" ON "turnos"("usuario_id") WHERE "cerrado_en" IS NULL;

-- Permisos nuevos: el perfil Admin los recibe todos; Supervisor, ver la caja y cerrar turnos ajenos.
INSERT INTO "perfil_permisos" ("perfil_id", "permiso")
SELECT p."id", x."permiso"
FROM "perfiles" p
CROSS JOIN (VALUES ('turnos.cerrar_ajenos'), ('caja.ver'), ('caja.liquidar'), ('caja.ajustar'), ('rendiciones.registrar')) AS x("permiso")
WHERE p."nombre" = 'Admin'
ON CONFLICT DO NOTHING;

INSERT INTO "perfil_permisos" ("perfil_id", "permiso")
SELECT p."id", x."permiso"
FROM "perfiles" p
CROSS JOIN (VALUES ('turnos.cerrar_ajenos'), ('caja.ver')) AS x("permiso")
WHERE p."nombre" = 'Supervisor'
ON CONFLICT DO NOTHING;
