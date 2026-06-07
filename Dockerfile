# Sea Launch AI — API app (root Next.js: /api/run live pipeline + audit).
# Build:  docker build -t sealaunch-api .
# Run:    docker run -p 3000:3000 --env-file .env.local sealaunch-api

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone server bundle (next.config.mjs: output "standalone").
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Runtime fs reads resolve from cwd — seed data and contract schema must be present.
COPY --from=build /app/seed ./seed
COPY --from=build /app/contract ./contract

# Audit snapshots + live-generated images persist via volumes (see docker-compose.yml).
RUN mkdir -p .runs public/generated && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "server.js"]
