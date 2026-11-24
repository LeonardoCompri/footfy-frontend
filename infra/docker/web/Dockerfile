# ---- Build do Vue ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . ./
# Caminho onde o site fica publicado (ex.: /footfy/). A API fica em <caminho>api
ARG BASE_PATH=/
ENV VITE_API_BASE_URL=${BASE_PATH}api
RUN npx vite build --base="$BASE_PATH"

# ---- Nginx: serve o site e encaminha /api e /storage para o Laravel ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY infra/docker/web/nginx.conf.template /etc/nginx/templates/default.conf.template
