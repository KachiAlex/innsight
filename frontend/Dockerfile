# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS base
WORKDIR /app

# VITE_API_URL is baked into the bundle at build time.
# Defaults to same-origin "/api" — the nginx config proxies /api to the api container.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Use nginx to serve the static files
FROM nginx:alpine AS runner
COPY --from=base /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
