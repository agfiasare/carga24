#!/usr/bin/env bash
# Prepara un VPS nuevo con Ubuntu 24.04 para Carga24. Se corre UNA vez, como root:
#   curl -fsSL https://raw.githubusercontent.com/agfiasare/carga24/main/deploy/preparar-servidor.sh -o preparar.sh
#   less preparar.sh            # leelo antes de correrlo
#   MODO=tunel bash preparar.sh # o MODO=directo si no usás Cloudflare
#
# Qué hace: actualiza el sistema, instala Docker, crea el usuario "carga24" (con tu
# clave SSH), cierra el ingreso por contraseña y de root, activa el firewall, fail2ban,
# las actualizaciones automáticas de seguridad, 2 GB de swap y la hora de Argentina.
# Se puede volver a correr sin romper nada.
set -euo pipefail

MODO="${MODO:-tunel}"
USUARIO="${USUARIO:-carga24}"

if [ "$(id -u)" != 0 ]; then echo "Correlo como root." >&2; exit 1; fi
if [ "$MODO" != tunel ] && [ "$MODO" != directo ]; then echo "MODO tiene que ser 'tunel' o 'directo'." >&2; exit 1; fi
paso() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

paso "Actualizando el sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl git ufw fail2ban unattended-upgrades jq

paso "Hora de Argentina"
timedatectl set-timezone America/Argentina/Buenos_Aires

paso "Docker (repositorio oficial)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

paso "Usuario $USUARIO"
if ! id "$USUARIO" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$USUARIO"
fi
usermod -aG docker,sudo "$USUARIO"
# Sudo sin contraseña (el usuario no tiene contraseña: solo entra con clave SSH).
echo "$USUARIO ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$USUARIO"
chmod 440 "/etc/sudoers.d/90-$USUARIO"
install -d -m 700 -o "$USUARIO" -g "$USUARIO" "/home/$USUARIO/.ssh"
if [ -s /root/.ssh/authorized_keys ]; then
  cat /root/.ssh/authorized_keys >> "/home/$USUARIO/.ssh/authorized_keys"
  sort -u -o "/home/$USUARIO/.ssh/authorized_keys" "/home/$USUARIO/.ssh/authorized_keys"
  chown "$USUARIO:$USUARIO" "/home/$USUARIO/.ssh/authorized_keys"
  chmod 600 "/home/$USUARIO/.ssh/authorized_keys"
fi

paso "SSH: solo con clave, sin root"
if [ -s "/home/$USUARIO/.ssh/authorized_keys" ]; then
  cat > /etc/ssh/sshd_config.d/90-carga24.conf <<'CONF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
CONF
  systemctl reload ssh
else
  echo "AVISO: no encontré una clave SSH en /root/.ssh/authorized_keys." >&2
  echo "       No cierro el ingreso por contraseña para no dejarte afuera." >&2
  echo "       Cargá tu clave en el panel de Hostinger y volvé a correr este script." >&2
fi

paso "Firewall"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
if [ "$MODO" = directo ]; then
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 443/udp
fi
ufw --force enable

paso "fail2ban y actualizaciones de seguridad automáticas"
cat > /etc/fail2ban/jail.d/sshd.local <<'CONF'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
CONF
systemctl enable --now fail2ban
systemctl restart fail2ban
echo 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";' > /etc/apt/apt.conf.d/20auto-upgrades

paso "Swap de 2 GB"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

paso "Listo"
echo "Ahora entrá como $USUARIO:  ssh $USUARIO@<ip-del-servidor>"
echo "y seguí con deploy/README.md (paso: Instalar Carga24)."
