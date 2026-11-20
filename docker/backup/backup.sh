#!/bin/sh
# Backup diario de PostgreSQL y de los comprobantes. Guarda volcados comprimidos
# en /backups y borra los de más de RETENCION_DIAS días.
#
# IMPORTANTE: /backups está en el mismo VPS. Configurá una copia fuera del
# servidor (por ejemplo, con rclone a un almacenamiento externo) y probá
# restaurar un backup una vez por mes.
set -eu

RETENCION_DIAS="${RETENCION_DIAS:-14}"
INTERVALO_SEGUNDOS="${INTERVALO_SEGUNDOS:-86400}"

while true; do
  archivo="/backups/carga24-$(date -u +%Y%m%d-%H%M%S).sql.gz"
  echo "[backup] generando $archivo"
  if pg_dump -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner | gzip > "$archivo"; then
    echo "[backup] listo"
  else
    echo "[backup] ERROR: falló el volcado" >&2
    rm -f "$archivo"
  fi
  comprobantes="/backups/comprobantes-$(date -u +%Y%m%d-%H%M%S).tar.gz"
  if tar -czf "$comprobantes" -C /archivos .; then
    echo "[backup] comprobantes listos"
  else
    echo "[backup] ERROR: falló la copia de comprobantes" >&2
    rm -f "$comprobantes"
  fi
  find /backups \( -name 'carga24-*.sql.gz' -o -name 'comprobantes-*.tar.gz' \) -mtime +"$RETENCION_DIAS" -delete
  sleep "$INTERVALO_SEGUNDOS"
done
