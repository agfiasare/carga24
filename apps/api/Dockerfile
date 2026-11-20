# Imagen de la API (NestJS). Se construye desde la raíz del repositorio:
#   docker build -f apps/api/Dockerfile .
FROM node:22-slim AS build
WORKDIR /app
RUN npm install -g npm@11.21.3

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @carga24/api -w @carga24/shared --include-workspace-root

COPY packages/shared packages/shared
COPY apps/api apps/api
# DATABASE_URL de mentira: generar el cliente no se conecta a la base.
RUN npm run build -w @carga24/shared \
  && cd apps/api \
  && DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
  && npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
# Carpeta de comprobantes (volumen): el volumen hereda este dueño al crearse.
RUN mkdir -p /datos/archivos && chown node:node /datos/archivos
USER node
EXPOSE 3000
# Aplica las migraciones pendientes y arranca la API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
