-- AlterEnum
ALTER TYPE "TipoMovimientoCaja" ADD VALUE 'pedido_sin_turno';

-- AlterTable
ALTER TABLE "movimientos_caja" ADD COLUMN     "pedido_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_caja_pedido_id_key" ON "movimientos_caja"("pedido_id");

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Permiso nuevo: operar pedidos sin abrir turno. Lo recibe el perfil Admin.
INSERT INTO "perfil_permisos" ("perfil_id", "permiso")
SELECT p."id", 'turnos.opcional' FROM "perfiles" p WHERE p."nombre" = 'Admin'
ON CONFLICT DO NOTHING;
