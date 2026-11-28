-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "impuesto" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "turnos" ADD COLUMN     "impuesto" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retiros_fichas" INTEGER NOT NULL DEFAULT 0;


-- Configuración nueva: comisión de retiro (por defecto 0, sin comisión).
INSERT INTO "configuracion" ("clave", "valor", "actualizado_en") VALUES ('retiro.comision_pb', '0', NOW()), ('retiro.dias_sin_carga', '0', NOW())
ON CONFLICT DO NOTHING;
