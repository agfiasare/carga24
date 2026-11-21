#!/usr/bin/env bash
# shellcheck disable=SC1091
# Operación diaria de Carga24 en el servidor. Se corre desde la carpeta del repositorio.
#
#   ./deploy/carga24.sh instalar        Primera vez: genera claves, levanta todo y crea el admin.
#   ./deploy/carga24.sh actualizar      Baja la última versión de main y la despliega.
#   ./deploy/carga24.sh estado          Contenedores, salud y último backup.
#   ./deploy/carga24.sh logs [servicio] Logs en vivo (api, caddy, db, backup, cloudflared).
#   ./deploy/carga24.sh backup          Hace un backup ahora.
#   ./deploy/carga24.sh restaurar <archivo.sql.gz>   Restaura la base desde un backup.
set -euo pipefail
cd "$(dirname "$0")/.."

paso() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
error() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

[ -f .env ] || error "No existe .env. Copiá .env.example a .env y completalo (ver deploy/README.md)."
# shellcheck disable=SC1091
set -a; . ./.env; set +a
MODO="${MODO:-tunel}"

compose() {
  if [ "$MODO" = tunel ]; then
    docker compose --profile tunel "$@"
  elif [ "$MODO" = directo ]; then
    docker compose -f docker-compose.yml -f docker-compose.directo.yml "$@"
  else
    error "MODO en .env tiene que ser 'tunel' o 'directo'"
  fi
}

completar_env() {
  # Genera las claves que falten y las guarda en .env (una sola vez).
  local cambio=0
  if [ -z "${POSTGRES_PASSWORD:-}" ]; then
    sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env; cambio=1
  fi
  if [ -z "${CLAVE_CIFRADO:-}" ]; then
    sed -i "s|^CLAVE_CIFRADO=.*|CLAVE_CIFRADO=$(openssl rand -base64 32)|" .env; cambio=1
  fi
  if [ "$cambio" = 1 ]; then
    set -a; . ./.env; set +a
    echo "Generé claves nuevas en .env. GUARDÁ UNA COPIA de CLAVE_CIFRADO y POSTGRES_PASSWORD fuera del servidor."
  fi
  [ -n "${DOMINIO:-}" ] || error "Falta DOMINIO en .env"
  if [ "$MODO" = tunel ]; then
    [ -n "${TUNNEL_TOKEN:-}" ] || error "Falta TUNNEL_TOKEN en .env (lo da Cloudflare al crear el túnel)"
    [ "${ESQUEMA:-}" = "http://" ] || error "En modo tunel, ESQUEMA tiene que ser http://"
  else
    [ -z "${ESQUEMA:-}" ] || error "En modo directo, ESQUEMA tiene que quedar vacío"
  fi
}

esperar_api() {
  paso "Esperando que la API esté sana"
  for _ in $(seq 1 60); do
    if compose exec -T api node -e "fetch('http://localhost:3000/api/v1/salud').then(r=>r.json()).then(d=>process.exit(d.baseDeDatos==='ok'?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
      echo "API OK"; return 0
    fi
    sleep 3
  done
  compose logs --tail 80 api
  error "La API no respondió. Revisá los logs de arriba."
}

probar_afuera() {
  local url="https://${DOMINIO}/api/v1/salud"
  if curl -fsS --max-time 15 "$url" >/dev/null; then
    echo "Desde internet: $url responde OK"
  else
    echo "AVISO: $url todavía no responde desde internet (DNS o túnel recién creados pueden tardar unos minutos)."
  fi
}

case "${1:-}" in
  instalar)
    completar_env
    paso "Construyendo las imágenes (la primera vez tarda unos minutos)"
    compose build
    paso "Levantando los servicios"
    compose up -d
    esperar_api
    paso "Carga inicial (perfiles, configuración y usuario admin)"
    if compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM usuarios WHERE nombre_usuario='admin'" | grep -q 1; then
      compose exec -T api node dist/seed.js
      echo "El admin ya existía: no se cambió su contraseña."
    else
      temporal="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
      compose exec -T -e SEED_ADMIN_PASSWORD="$temporal" api node dist/seed.js
      printf '\n\033[1;32mUsuario: admin   Contraseña temporal: %s\033[0m\n' "$temporal"
      echo "Se muestra una sola vez. Al ingresar a https://panel.${DOMINIO} te pide cambiarla y activar el 2FA."
    fi
    probar_afuera
    ;;
  actualizar)
    completar_env
    paso "Bajando la última versión"
    git pull --ff-only
    paso "Construyendo"
    compose build
    paso "Reemplazando los contenedores (las migraciones corren solas al arrancar la API)"
    compose up -d --remove-orphans
    esperar_api
    docker image prune -f >/dev/null
    probar_afuera
    ;;
  estado)
    compose ps
    echo
    if [ -f backups/ULTIMO_OK ]; then echo "Último backup completo: $(cat backups/ULTIMO_OK) (UTC)"; else echo "AVISO: todavía no hay un backup completo."; fi
    df -h / | tail -1 | awk '{print "Disco: " $3 " usados de " $2 " (" $5 ")"}'
    ;;
  logs)
    compose logs -f --tail 100 ${2:+"$2"}
    ;;
  backup)
    compose run --rm -e UNA_VEZ=1 backup
    ls -lh backups | tail -5
    ;;
  restaurar)
    archivo="${2:-}"
    [ -f "$archivo" ] || error "Indicá un archivo de backup existente, por ejemplo: ./deploy/carga24.sh restaurar backups/carga24-20261120-030000.sql.gz"
    gzip -t "$archivo" || error "El archivo está dañado"
    read -r -p "Esto REEMPLAZA la base actual con $archivo. Escribí RESTAURAR para seguir: " confirma
    [ "$confirma" = RESTAURAR ] || error "Cancelado"
    paso "Backup de seguridad del estado actual"
    compose run --rm -e UNA_VEZ=1 backup || true
    paso "Deteniendo la API"
    compose stop api caddy
    paso "Restaurando"
    gunzip -c "$archivo" | compose exec -T db psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null
    paso "Levantando de nuevo"
    compose up -d
    esperar_api
    echo "Restauración lista. Las sesiones abiertas siguen valiendo solo si existían en ese backup."
    ;;
  *)
    sed -n '2,10p' "$0"
    exit 1
    ;;
esac
