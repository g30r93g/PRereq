# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
# Enable corepack so pnpm is available
RUN corepack enable

# Install deps with caching
COPY package.json pnpm-lock.yaml* ./
COPY tsconfig.json drizzle.config.ts eslint.config.ts ./
RUN pnpm install --frozen-lockfile

# Build
COPY src ./src
RUN pnpm build

# ---------- Runtime ----------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

# Copy built app + node_modules (includes devDeps so drizzle-kit is available for migrations)
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY package.json ./
COPY drizzle.config.ts ./drizzle.config.ts

# Optional: non-root user
# RUN addgroup -S nodegrp && adduser -S node -G nodegrp
# USER node

# Entrypoint runs migrations then starts the app
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000
CMD ["/entrypoint.sh"]