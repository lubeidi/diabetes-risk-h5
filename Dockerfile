FROM node:20-alpine AS vendor
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/copy-vendor-assets.mjs ./scripts/
RUN npm ci

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/
COPY public/config.js public/moeagi-client.js public/tracker.js public/app.js /usr/share/nginx/html/
COPY --from=vendor /app/public/vendor /usr/share/nginx/html/vendor

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

