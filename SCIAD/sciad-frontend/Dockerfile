# ============================================================
# SCIAD — Frontend (Angular)
# Docker multi-stage: build en node → servido por nginx.
# Fase 1: solo frontend con datos mock. `docker compose up` desde la raíz.
# ============================================================

# ---- Etapa 1: build ----
FROM node:22-alpine AS build
WORKDIR /app

# Instala dependencias primero (mejor cache de capas)
COPY package.json package-lock.json ./
RUN npm ci

# Copia el código y compila en modo producción
COPY . .
RUN npm run build -- --configuration production

# ---- Etapa 2: servidor web ----
FROM nginx:1.27-alpine

# Configuración: SPA fallback + cabeceras
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia la app compilada
COPY --from=build /app/dist/sciad-frontend/browser /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
