# Servidor de entrada: compila la web de React y la sirve con Caddy (HTTPS automático).
#   docker build -f docker/caddy/Dockerfile .
FROM node:22-slim AS build
WORKDIR /app
RUN npm install -g npm@11.21.3

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @carga24/web -w @carga24/shared --include-workspace-root

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @carga24/shared && npm run build -w @carga24/web

FROM caddy:2-alpine
COPY docker/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv/web
