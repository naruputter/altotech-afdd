# =========================================================
# Stage 1: Build Frontend SPA
# =========================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies with clean cache
COPY package*.json ./
RUN npm ci --no-audit --prefer-offline

# Copy source files and build
COPY . .
RUN npm run build

# =========================================================
# Stage 2: Production Nginx Server (Lightweight ~25MB)
# =========================================================
FROM nginx:alpine

# Remove default nginx static assets and config
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 5173

# Healthcheck for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5173/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
