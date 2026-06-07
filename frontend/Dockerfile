# Sea Launch AI — frontend app (marketing site + seller workspace UI).
# NOTE: build from the REPO ROOT context (the app imports ../contract):
#   docker build -t sealaunch-frontend -f frontend/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com .

FROM node:22-alpine AS deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
# contract/ is imported via relative paths; tracing root is the repo root.
COPY contract ./contract
COPY frontend ./frontend
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
# NEXT_PUBLIC_* vars are inlined at BUILD time.
ARG NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
WORKDIR /app/frontend
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# outputFileTracingRoot=.. → standalone mirrors the repo layout (frontend/server.js).
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
COPY --from=build /app/frontend/public ./frontend/public

RUN chown -R node:node /app
USER node

EXPOSE 3001
CMD ["node", "frontend/server.js"]
