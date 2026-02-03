# syntax=docker/dockerfile:1.6
FROM node:20-slim AS base
ENV NODE_ENV=production
WORKDIR /usr/src/app

FROM base AS deps
COPY package*.json ./
RUN npm install --include=dev

FROM deps AS build
COPY . .
RUN npm run build
# Don't prune devDependencies since we need them for the build

FROM base AS runner
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY package*.json ./

EXPOSE 8080
CMD ["node", "dist/index.js"]
