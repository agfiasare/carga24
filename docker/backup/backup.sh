#!/bin/sh
# Backup diario de PostgreSQL y de los comprobantes.
#
# - En el servidor: volcados comprimidos en /backups, se borran los de más de RETENCION_DIAS.
# - Fuera del servidor (si COPIA_EXTERNA está definida, por ejemplo "externa:carga24-backups"):
#   cada volcado se sube, y los comprobantes se copian de forma incremental (solo los nuevos).
# - /backups/ULTIMO_OK guarda la fecha del último backup completo sin errores.
#
# UNA_VEZ=1 hace un solo backup y termina (lo usa "deploy/carga24.sh backup").
set -u

RETENCION_DIAS="${RETENCION_DIAS:-14}"
INTERVALO_SEGUNDOS="${INTERVALO_SEGUNDOS:-86400}"
COPIA_EXTERNA="${COPIA_EXTERNA:-}"

hacer_backup() {
  errores=0
  sello="$(date -u +%Y%m%d-%H%M%S)"
  archivo="/backups/carga24-${sello}.sql.gz"
  echo "[backup] $(date -u +%FT%TZ) generando $archivo"
  if pg_dump -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists | gzip > "$archivo.tmp" && gzip -t "$archivo.tmp"; then
    mv "$archivo.tmp" "$archivo"
  else
    echo "[backup] ERROR: falló el volcado de la base" >&2
    rm -f "$archivo.tmp"
    errores=1
  fi

  if [ -n "$COPIA_EXTERNA" ]; then
    if [ "$errores" = 0 ] && ! rclone copy "$archivo" "$COPIA_EXTERNA/base/" --s3-no-check-bucket; then
      echo "[backup] ERROR: no se pudo subir el volcado a $COPIA_EXTERNA" >&2
      errores=1
    fi
    # Incremental: solo sube los comprobantes que todavía no están afuera.
    if ! rclone copy /archivos "$COPIA_EXTERNA/comprobantes/" --s3-no-check-bucket; then
      echo "[backup] ERROR: no se pudieron subir los comprobantes" >&2
      errores=1
    fi
  else
    # Sin copia externa, al menos queda una copia local de los comprobantes.
    if ! tar -czf "/backups/comprobantes-${sello}.tar.gz" -C /archivos .; then
      echo "[backup] ERROR: falló la copia de comprobantes" >&2
      rm -f "/backups/comprobantes-${sello}.tar.gz"
      errores=1
    fi
    echo "[backup] AVISO: no hay COPIA_EXTERNA configurada; los backups quedan solo en este servidor" >&2
  fi

  find /backups \( -name 'carga24-*.sql.gz' -o -name 'comprobantes-*.tar.gz' \) -mtime +"$RETENCION_DIAS" -delete
  if [ "$errores" = 0 ]; then
    date -u +%FT%TZ > /backups/ULTIMO_OK
    echo "[backup] listo"
  fi
  return "$errores"
}

if [ "${UNA_VEZ:-0}" = 1 ]; then
  hacer_backup
  exit $?
fi

while true; do
  hacer_backup || true
  sleep "$INTERVALO_SEGUNDOS"
done
