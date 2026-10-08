# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependency manifests and the local tgz package
COPY package.json package-lock.json humkyung-viewer3d-0.2.0.tgz ./
RUN npm ci

# Copy application source code and build
COPY . .
RUN npm run build

# Stage 2: Production Nginx Server
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
