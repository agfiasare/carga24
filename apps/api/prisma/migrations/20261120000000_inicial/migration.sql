-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('jugador', 'staff');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('activo', 'bloqueado');

-- CreateEnum
CREATE TYPE "TipoAjuste" AS ENUM ('agregar', 'quitar');

-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('pendiente', 'verificada', 'rechazada');

-- CreateEnum
CREATE TYPE "TipoPedido" AS ENUM ('carga', 'retiro');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('pendiente', 'en_proceso', 'espera_aprobacion', 'verificado', 'acreditado', 'pagado', 'rechazado');

-- CreateEnum
CREATE TYPE "Canal" AS ENUM ('web', 'manual');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('cuenta_registrada', 'otra_cuenta', 'efectivo');

-- CreateEnum
CREATE TYPE "ModoComision" AS ENUM ('recargo', 'descuento');

-- CreateEnum
CREATE TYPE "TipoComprobante" AS ENUM ('pago', 'retiro');

-- CreateEnum
CREATE TYPE "EstadoLiquidacion" AS ENUM ('abierta', 'cerrada', 'pagada');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "tipo" "TipoUsuario" NOT NULL,
    "nombre_usuario" TEXT,
    "telefono" TEXT,
    "usuario_plataforma" TEXT,
    "nombre_visible" TEXT,
    "contrasena_hash" TEXT NOT NULL,
    "debe_cambiar_contrasena" BOOLEAN NOT NULL DEFAULT false,
    "dos_factores_secreto" TEXT,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'activo',
    "creado_por_id" TEXT,
    "perfil_id" TEXT,
    "comision_operador_pb" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfiles" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil_permisos" (
    "perfil_id" TEXT NOT NULL,
    "permiso" TEXT NOT NULL,

    CONSTRAINT "perfil_permisos_pkey" PRIMARY KEY ("perfil_id","permiso")
);

-- CreateTable
CREATE TABLE "ajustes_permisos" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "permiso" TEXT NOT NULL,
    "tipo" "TipoAjuste" NOT NULL,
    "otorgado_por_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "vence_en" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "dispositivo" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_bancarias" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "cbu_cvu" TEXT NOT NULL,
    "alias" TEXT,
    "banco" TEXT,
    "titular" TEXT,
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'pendiente',
    "verificada_con_pedido_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plataformas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plataformas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoPedido" NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'pendiente',
    "canal" "Canal" NOT NULL,
    "medio_pago" "MedioPago",
    "jugador_id" TEXT,
    "telefono" TEXT,
    "plataforma_id" TEXT NOT NULL,
    "monto_pagado" INTEGER,
    "monto" INTEGER NOT NULL,
    "ganancia" INTEGER NOT NULL DEFAULT 0,
    "comision_pb" INTEGER NOT NULL,
    "modo_comision" "ModoComision" NOT NULL,
    "comision_operador_pb" INTEGER,
    "comision_operador_monto" INTEGER,
    "cuenta_id" TEXT,
    "referencia_movimiento" TEXT,
    "codigo_promo" TEXT,
    "promocion_id" TEXT,
    "motivo_rechazo" TEXT,
    "tomado_por_id" TEXT,
    "tomado_en" TIMESTAMP(3),
    "verificado_por_id" TEXT,
    "verificado_en" TIMESTAMP(3),
    "ejecutado_por_id" TEXT,
    "ejecutado_en" TIMESTAMP(3),
    "liquidacion_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_pedido" (
    "id" TEXT NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "de" "EstadoPedido",
    "a" "EstadoPedido" NOT NULL,
    "actor_id" TEXT,
    "nota" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes" (
    "id" TEXT NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "tipo" "TipoComprobante" NOT NULL,
    "clave_almacenamiento" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "subido_por_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones" (
    "id" TEXT NOT NULL,
    "operador_id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "cantidad_pedidos" INTEGER NOT NULL DEFAULT 0,
    "ganancia_generada" INTEGER NOT NULL DEFAULT 0,
    "ajustes" INTEGER NOT NULL DEFAULT 0,
    "total_a_cobrar" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoLiquidacion" NOT NULL DEFAULT 'abierta',
    "cerrada_por_id" TEXT,
    "cerrada_en" TIMESTAMP(3),
    "pagada_en" TIMESTAMP(3),

    CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promociones" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "condiciones" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "en_landing" BOOLEAN NOT NULL DEFAULT false,
    "en_inicio" BOOLEAN NOT NULL DEFAULT false,
    "en_novedades" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promociones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novedades" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "fijada" BOOLEAN NOT NULL DEFAULT false,
    "publicada_en" TIMESTAMP(3),
    "autor_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "novedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT,
    "leida_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "actualizado_por_id" TEXT,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT,
    "datos" JSONB,
    "ip" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_nombre_usuario_key" ON "usuarios"("nombre_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_telefono_key" ON "usuarios"("telefono");

-- CreateIndex
CREATE INDEX "usuarios_tipo_idx" ON "usuarios"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "perfiles_nombre_key" ON "perfiles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ajustes_permisos_usuario_id_permiso_key" ON "ajustes_permisos"("usuario_id", "permiso");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_token_hash_key" ON "sesiones"("token_hash");

-- CreateIndex
CREATE INDEX "sesiones_usuario_id_idx" ON "sesiones"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_bancarias_cbu_cvu_key" ON "cuentas_bancarias"("cbu_cvu");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_bancarias_verificada_con_pedido_id_key" ON "cuentas_bancarias"("verificada_con_pedido_id");

-- CreateIndex
CREATE INDEX "cuentas_bancarias_usuario_id_estado_idx" ON "cuentas_bancarias"("usuario_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "plataformas_nombre_key" ON "plataformas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_referencia_movimiento_key" ON "pedidos"("referencia_movimiento");

-- CreateIndex
CREATE INDEX "pedidos_estado_creado_en_idx" ON "pedidos"("estado", "creado_en");

-- CreateIndex
CREATE INDEX "pedidos_jugador_id_idx" ON "pedidos"("jugador_id");

-- CreateIndex
CREATE INDEX "pedidos_telefono_idx" ON "pedidos"("telefono");

-- CreateIndex
CREATE INDEX "eventos_pedido_pedido_id_idx" ON "eventos_pedido"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "liquidaciones_operador_id_periodo_key" ON "liquidaciones"("operador_id", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "promociones_codigo_key" ON "promociones"("codigo");

-- CreateIndex
CREATE INDEX "notificaciones_usuario_id_leida_en_idx" ON "notificaciones"("usuario_id", "leida_en");

-- CreateIndex
CREATE INDEX "auditoria_entidad_entidad_id_idx" ON "auditoria"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "auditoria_actor_id_creado_en_idx" ON "auditoria"("actor_id", "creado_en");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_permisos" ADD CONSTRAINT "perfil_permisos_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_permisos" ADD CONSTRAINT "ajustes_permisos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_jugador_id_fkey" FOREIGN KEY ("jugador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_tomado_por_id_fkey" FOREIGN KEY ("tomado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_verificado_por_id_fkey" FOREIGN KEY ("verificado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_ejecutado_por_id_fkey" FOREIGN KEY ("ejecutado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_plataforma_id_fkey" FOREIGN KEY ("plataforma_id") REFERENCES "plataformas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas_bancarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_promocion_id_fkey" FOREIGN KEY ("promocion_id") REFERENCES "promociones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "liquidaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_pedido" ADD CONSTRAINT "eventos_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_operador_id_fkey" FOREIGN KEY ("operador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Reglas que Prisma no expresa en el esquema --------------------------------

-- Todo usuario necesita al menos un dato para ingresar: nombre de usuario o teléfono.
ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_identificador_requerido"
  CHECK ("nombre_usuario" IS NOT NULL OR "telefono" IS NOT NULL);

-- Los montos nunca son negativos.
ALTER TABLE "pedidos"
  ADD CONSTRAINT "pedidos_montos_no_negativos"
  CHECK ("monto" >= 0 AND "ganancia" >= 0 AND ("monto_pagado" IS NULL OR "monto_pagado" >= 0));

-- La auditoría es solo de escritura: no se puede editar ni borrar.
CREATE OR REPLACE FUNCTION auditoria_solo_insercion() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La auditoría no se puede modificar ni borrar';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditoria_sin_cambios
  BEFORE UPDATE OR DELETE ON "auditoria"
  FOR EACH ROW EXECUTE FUNCTION auditoria_solo_insercion();
