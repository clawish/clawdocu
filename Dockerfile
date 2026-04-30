FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native addons (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Install all dependencies (including dev for build)
COPY package*.json .npmrc ./
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --omit=dev

# Create non-root user and data directory
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    mkdir -p /data && \
    chown -R nextjs:nodejs /data

ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

EXPOSE 3000

# Run as non-root user
USER nextjs

CMD ["node", ".output/server/index.mjs"]
