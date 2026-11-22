# Despliegue de Carga24

Guía para poner Carga24 en un VPS de Hostinger con Cloudflare adelante. Está pensada para seguirse de arriba hacia abajo la primera vez; las secciones del final son para el día a día.

```
Jugador / staff ──HTTPS──▶ Cloudflare ──túnel cifrado──▶ VPS: cloudflared ─▶ Caddy ─▶ API ─▶ PostgreSQL
                          (DNS, HTTPS,                    (sin puertos web abiertos)  │
                           protección)                                                └─▶ backups ─▶ Cloudflare R2
```

**Por qué así:** con Cloudflare Tunnel el servidor no abre los puertos 80 ni 443. Solo queda abierto SSH, la IP real del VPS no se publica en el DNS, y Cloudflare frena ataques y bots antes de que lleguen. El HTTPS lo pone Cloudflare, así que en el servidor no hay certificados que renovar.

---

## 1. Qué contratar

**VPS en Hostinger**

| Plan | Para qué alcanza |
| --- | --- |
| KVM 1 (1 vCPU, 4 GB) | Piloto con las operadoras y los primeros meses |
| **KVM 2 (2 vCPU, 8 GB)** | Recomendado: margen para la cola en vivo y los reportes |

Al crearlo:

- **Sistema:** Ubuntu 24.04 limpio, sin panel.
- **Ubicación:** la más cercana a Argentina que ofrezcan (por ejemplo, Brasil).
- **Clave SSH:** cargá la tuya. Si no tenés una, generala en tu computadora con `ssh-keygen -t ed25519` y pegá el contenido de `~/.ssh/id_ed25519.pub`.
- **Firewall de Hostinger (hPanel):** dejá abierto solo el puerto 22 (SSH).

**Dominio y Cloudflare**

1. Registrá el dominio (`carga24.com.ar`) en NIC Argentina, si todavía no lo tenés.
2. Creá una cuenta gratis en Cloudflare y agregá el dominio (plan **Free**).
3. Cloudflare te da dos *nameservers*. Cargalos en NIC Argentina: **Trámites → Delegaciones** del dominio. Puede tardar unas horas; Cloudflare te avisa por email cuando está activo.

## 2. Crear el túnel en Cloudflare

1. En Cloudflare, abrí **Zero Trust → Networks → Tunnels → Create a tunnel**, tipo **Cloudflared**, con el nombre `carga24`.
2. En "Install connector", **copiá el token**: es el texto largo después de `--token`. Va en `.env` como `TUNNEL_TOKEN`. No hace falta instalar nada; el conector ya está en el `docker-compose.yml`.
3. En **Public hostnames**, agregá estos tres, todos con **Service: `HTTP` → `caddy:80`**:

   | Subdomain | Domain | Service |
   | --- | --- | --- |
   | *(vacío)* | carga24.com.ar | `HTTP` `caddy:80` |
   | www | carga24.com.ar | `HTTP` `caddy:80` |
   | panel | carga24.com.ar | `HTTP` `caddy:80` |

   Cloudflare crea solo los registros DNS.

## 3. Ajustes recomendados en Cloudflare

| Dónde | Qué |
| --- | --- |
| SSL/TLS → Edge Certificates | **Always Use HTTPS**: activado. **Minimum TLS**: 1.2 |
| Caching → Cache Rules | Regla "API sin caché": *URI Path starts with* `/api/` → **Bypass cache** |
| Security → WAF → Rate limiting rules | Regla "Ingresos": *URI Path contains* `/auth/` **y** *Method* `POST` → 20 pedidos cada 10 s por IP → **Block** |
| Network | **WebSockets** y **HTTP/2** activados (vienen así) |

Opcional, para más seguridad del panel: **Zero Trust → Access → Applications** sobre `panel.carga24.com.ar`, con la lista de emails del staff. Cloudflare les pide un código por email antes de mostrar el panel, además del usuario, la contraseña y el 2FA de Carga24. Es gratis hasta 50 personas.

> La cola en vivo funciona a través de Cloudflare: la API manda un "latido" cada 25 segundos, así la conexión no se corta por inactividad.

## 4. Preparar el servidor (una sola vez)

Se puede hacer desde la computadora (`ssh -i ~/.ssh/carga24_vps root@IP_DEL_VPS`) o desde el celular, con la terminal del navegador de Hostinger: **hPanel → VPS → Terminal del navegador**. Cada bloque se copia y se pega entero.

**4.1 Clave de solo lectura para bajar el código.** El repositorio es privado: el servidor necesita su propia clave.

```bash
ssh-keygen -t ed25519 -N "" -f /root/.ssh/github_carga24 -C "vps carga24" && cat /root/.ssh/github_carga24.pub
```

Copiá la línea que empieza con `ssh-ed25519` y pegala en GitHub: **repositorio → Settings → Deploy keys → Add deploy key**. Ponele de título "VPS" y **no** marques "Allow write access".

**4.2 Bajar el código y preparar el servidor:**

```bash
GIT_SSH_COMMAND="ssh -i /root/.ssh/github_carga24 -o StrictHostKeyChecking=accept-new" git clone git@github.com:agfiasare/carga24.git /opt/carga24 && MODO=tunel bash /opt/carga24/deploy/preparar-servidor.sh
```

El script:

- Actualiza Ubuntu e instala Docker.
- Crea el usuario `carga24` con tu clave SSH y le pasa el repositorio (queda en `~/carga24`).
- Desactiva el ingreso con contraseña y el de root.
- Activa el firewall (solo SSH), fail2ban, las actualizaciones de seguridad automáticas y 2 GB de swap.
- Pone la hora de Argentina.

A partir de ahora, entrá siempre como `carga24`:

```bash
ssh -i ~/.ssh/carga24_vps carga24@IP_DEL_VPS
```

> En la terminal del navegador de Hostinger se entra como root. Para pasar al usuario: `su - carga24`.

## 5. Instalar Carga24

```bash
cd ~/carga24 && cp .env.example .env && nano .env
```

Completá `DOMINIO` y `TUNNEL_TOKEN`. Las contraseñas de la base y `CLAVE_CIFRADO` se generan solas si las dejás vacías. Guardá con **Ctrl+O**, Enter, y salí con **Ctrl+X**. Después:

```bash
./deploy/carga24.sh instalar
```

Al terminar muestra **una sola vez** la contraseña temporal del usuario `admin`.

> **Guardá fuera del servidor** (en un gestor de contraseñas) `CLAVE_CIFRADO` y `POSTGRES_PASSWORD` de `.env`. Sin `CLAVE_CIFRADO`, un backup restaurado en otro servidor obliga a todo el staff a reconfigurar el 2FA.

## 6. Primer ingreso y puesta a punto

1. Entrá a `https://panel.carga24.com.ar` con `admin` y la contraseña temporal. Elegí una contraseña nueva y activá el 2FA con Google Authenticator o similar.
2. **Configuración:** comisión, montos, datos para transferir, horario y WhatsApp de atención. En **Plataformas**, renombrá "Plataforma principal" con el nombre real.
3. **Perfiles:** revisá los cuatro iniciales (Operador, Pagos, Supervisor, Admin).
4. **Staff:** dá de alta a las operadoras. A cada una le das su contraseña temporal; en el primer ingreso configura su 2FA.
5. Probá un pedido completo, de punta a punta, desde un celular.

## 7. Backups fuera del servidor (Cloudflare R2)

Cada día se guarda en el VPS un volcado de la base y una copia de los comprobantes. Si el VPS se pierde, esas copias se pierden con él, así que configurá la copia externa:

1. **Crear el bucket:** en Cloudflare, **R2 → Create bucket**, con el nombre `carga24-backups`. R2 tiene 10 GB gratis por mes.
2. **Credenciales:** en **R2 → Manage API tokens → Create API token**, con permiso *Object Read & Write* solo sobre ese bucket. Anotá el *Access Key ID*, el *Secret Access Key* y el *endpoint* (`https://<id>.r2.cloudflarestorage.com`).
3. **Retención:** en el bucket, **Settings → Object lifecycle rules**, agregá una regla que borre `base/` después de 60 días.
4. **`.env`:** completá estos datos:

   ```
   COPIA_EXTERNA=externa:carga24-backups
   COPIA_ENDPOINT=https://<id>.r2.cloudflarestorage.com
   COPIA_ACCESS_KEY_ID=...
   COPIA_SECRET_ACCESS_KEY=...
   ```

5. **Aplicar y probar:**

   ```bash
   ./deploy/carga24.sh actualizar
   ```

   ```bash
   ./deploy/carga24.sh backup
   ```

   Verificá en R2 que aparezcan `base/` y `comprobantes/`.

Los volcados de la base se suben completos. Los comprobantes se suben de forma incremental: cada noche, solo los nuevos.

**Probá restaurar una vez por mes.** Un backup que nunca se restauró no está probado; ver la sección 8.

## 8. Día a día

| Para | Comando |
| --- | --- |
| Publicar una versión nueva (después de unir un PR a `main`) | `./deploy/carga24.sh actualizar` |
| Ver si todo está bien, el último backup y el disco | `./deploy/carga24.sh estado` |
| Ver logs | `./deploy/carga24.sh logs api` (o `caddy`, `db`, `backup`, `cloudflared`) |
| Hacer un backup ahora | `./deploy/carga24.sh backup` |
| Restaurar la base | `./deploy/carga24.sh restaurar backups/carga24-AAAAMMDD-HHMMSS.sql.gz` |

`actualizar`:

- Baja `main` y reconstruye.
- Reemplaza los contenedores; las migraciones de la base corren solas.
- Espera a que la API responda y prueba la URL pública.

`restaurar`:

- Primero hace un backup del estado actual.
- Pide escribir `RESTAURAR` para confirmar.
- Detiene la API, restaura y vuelve a levantar todo.

**Si un backup está en R2 y no en el VPS:** bajalo desde el panel de R2 a la carpeta `backups/` y restauralo igual.

## 9. Si algo falla

| Síntoma | Qué mirar |
| --- | --- |
| El sitio no abre (error 1033 de Cloudflare) | El túnel está caído: `./deploy/carga24.sh logs cloudflared`. Suele ser un `TUNNEL_TOKEN` mal copiado. |
| Error 502 | La API no arrancó: `./deploy/carga24.sh logs api`. |
| La cola no se actualiza sola | Recargá la página. Si sigue igual, revisá que la regla de caché de `/api/` esté en *Bypass*. |
| Todos los intentos de ingreso aparecen con la misma IP | Revisá que el túnel apunte a `caddy:80`; Caddy toma la IP real del encabezado de Cloudflare. |
| Disco lleno | `./deploy/carga24.sh estado`. Bajá `RETENCION_DIAS` en `.env` o borrá backups locales viejos (ya están en R2). |

## Sin Cloudflare (modo directo)

Si en algún momento no querés usar Cloudflare:

1. En `.env`, poné `MODO=directo` y `ESQUEMA=` vacío.
2. Apuntá el DNS (registros A de `@`, `www` y `panel`) a la IP del VPS.
3. Corré `preparar-servidor.sh` con `MODO=directo`, que abre los puertos 80 y 443.
4. Corré `./deploy/carga24.sh actualizar`.

Caddy saca y renueva solo los certificados de Let's Encrypt.

## Seguridad: lista de control

- [ ] SSH solo con clave; root y contraseñas desactivados (lo hace `preparar-servidor.sh`).
- [ ] Firewall: solo el puerto 22 abierto, en Ubuntu y en el hPanel de Hostinger.
- [ ] `CLAVE_CIFRADO` y `POSTGRES_PASSWORD` guardadas fuera del servidor.
- [ ] Todo el staff con 2FA; el admin con una contraseña larga.
- [ ] Copia externa de backups activa, y una restauración probada este mes.
- [ ] Reglas de Cloudflare: HTTPS siempre, caché desactivada para `/api/` y límite de intentos en `/auth/`.
