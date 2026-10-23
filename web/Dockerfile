# syntax=docker/dockerfile:1
# Web-Image: React-SPA, ausgeliefert von nginx ohne root (Port 8080).
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
# --legacy-peer-deps: eine Abhängigkeit deklariert ein zu enges Peer-Dependency-Range
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
