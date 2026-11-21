# Carga24

Plataforma para gestionar pedidos de carga de saldo y retiro de premios: landing, app del jugador y panel del staff, con una API propia.

La definición funcional completa (decisiones, especificación técnica, backlog) está en el documento del proyecto.

## Estructura

```
carga24/
├── apps/
│   ├── api/        NestJS + Prisma (PostgreSQL)
│   └── web/        React + TypeScript + Vite (landing, app del jugador y panel del staff)
├── packages/
│   └── shared/     Tipos y reglas compartidas: estados del pedido, catálogo de permisos, cálculo de comisiones
├── docker/         Caddy (HTTPS y archivos de la web) y backup de la base
├── docker-compose.yml       Producción (VPS)
└── docker-compose.dev.yml   Base de datos para desarrollo local
```

## Requisitos

- Node.js 22.12 o superior
- npm 11 (`npm install -g npm@11`)
- Docker (solo para la base de datos local y para producción)

## Desarrollo local

```bash
npm install
cp apps/api/.env.example apps/api/.env   # completar CLAVE_CIFRADO con: openssl rand -base64 32
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL en el puerto 5432
npm run build:shared
npm run db:generate
npm run db:migrate
```

Carga inicial (perfiles de permisos, configuración y usuario `admin`):

```bash
npm run build -w @carga24/api
SEED_ADMIN_PASSWORD='una-contraseña-larga' npm run prisma:seed -w @carga24/api
```

Levantar todo:

```bash
npm run dev:api        # http://localhost:3000/api/v1/salud
npm run dev:web        # http://localhost:5173
npm run storybook      # http://localhost:6006
```

- App del jugador: http://localhost:5173/ingresar y `/registro`. Adentro: inicio, cargar, retirar, pedidos, cuentas, novedades y avisos.
- Panel del staff: http://localhost:5173/panel (en producción es `panel.<dominio>`). El primer ingreso de `admin` pide cambiar la contraseña y activar el 2FA con una app de autenticación.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run lint` | ESLint en todo el monorepo |
| `npm run typecheck` | Chequeo de tipos de cada paquete |
| `npm test` | Tests (Vitest) de shared, api y web |
| `npm run test:e2e` | Tests de punta a punta de la API contra PostgreSQL. **Borran la base**: usar una que termine en `_test` (`DATABASE_URL=.../carga24_test`) |
| `npm run build` | Compila shared, api y web |
| `npm run db:migrate` | Crea y aplica una migración nueva (desarrollo) |

La integración continua (`.github/workflows/ci.yml`) corre lint, tipos, tests, migraciones sobre PostgreSQL, la carga inicial y los builds de la web y de Storybook en cada push y pull request.

## Convenciones

- **Dinero:** todos los montos son enteros en **centavos** y los porcentajes en **puntos básicos** (1 % = 100). Usar siempre las funciones de `@carga24/shared` (`calcularCarga`, `comisionOperador`, `formatearPesos`).
- **Permisos:** cada funcionalidad del panel tiene su permiso en `packages/shared/src/permisos.ts`. Las rutas de la API se protegen con `@RequierePermisos('...')`. Funcionalidad nueva = permiso nuevo en el catálogo.
- **Acceso a rutas:** cada controlador declara quién lo usa: `@Publico()`, `@SoloJugador()`, `@SoloStaff()` o `@StaffPendiente()`. Si no declara nada, se trata como `@SoloStaff()`.
- **Pedidos:** los cambios de estado pasan por `PedidosService.accionar`, que actualiza de forma atómica (estado + versión): si dos personas actúan a la vez, una recibe 409. La cola en vivo usa Server-Sent Events (`GET /api/v1/pedidos/eventos`).
- **Portal del jugador:** todo bajo `/api/v1/yo/...` y siempre limitado a lo suyo. Un pedido abierto por vez; la carga web exige el comprobante en el mismo envío. Los avisos (`notificaciones`) se crean al acreditar, pagar o rechazar, y llegan en vivo por `/api/v1/yo/eventos`.
- **Comprobantes:** fotos (JPG, PNG, WEBP) o PDF de hasta 10 MB, reconocidos por su contenido. Se guardan en `DIRECTORIO_ARCHIVOS` (en producción, el volumen `archivos`, que entra en el backup diario).
- **Sesiones:** cookie httpOnly por ámbito (`c24_jugador`, `c24_staff`); el token se guarda solo como hash. La web llama a `/api` en su mismo dominio (en producción lo enruta Caddy).
- **Estados del pedido:** las transiciones válidas están en `packages/shared/src/pedidos.ts` (`siguienteEstado`). El backend rechaza cualquier otro paso.
- **Frontend:** Atomic Design en `apps/web/src/componentes` (átomos, moléculas, organismos). Los átomos no llaman a la API y usan los tokens de `estilos/` (nunca colores escritos a mano). Cada componente tiene su historia de Storybook y sus tests.
- **Módulos ES** en todo el monorepo: los imports relativos del backend y de shared llevan extensión `.js`.
- **Ramas:** `main` siempre estable. Cada historia del backlog va en su propia rama y se une por pull request.

## Producción (VPS de Hostinger + Cloudflare)

Todo el paso a paso está en [`deploy/README.md`](deploy/README.md):

1. Preparar el servidor con `deploy/preparar-servidor.sh`.
2. Crear el túnel de Cloudflare.
3. Instalar con `./deploy/carga24.sh instalar`.
4. Configurar los backups fuera del servidor (Cloudflare R2).

Para el día a día se usa el mismo script: `actualizar`, `estado`, `logs`, `backup` y `restaurar`.

La CI levanta en cada PR el `docker-compose.yml` de producción y prueba Caddy, la API, la base, el backup y la restauración.
