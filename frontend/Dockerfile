# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_URL=http://localhost:3000/api/v1
ARG VITE_WS_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_URL=$VITE_WS_URL

COPY package.json package-lock.json ./
COPY scripts ./scripts
# postinstall menyalin wasm MediaPipe & mengunduh model ke public/
RUN npm ci

COPY . .
RUN npm run build

# ---------- runtime ----------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
