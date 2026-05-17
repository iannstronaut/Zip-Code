# Multi-stage build for ZIP CODE

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY src ./src
COPY scripts ./scripts

# Build
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

# Create non-root user
RUN addgroup -g 1001 -S zipcode && \
    adduser -S zipcode -u 1001 -G zipcode

# Create data directory
RUN mkdir -p /home/zipcode/.zipcode && \
    chown -R zipcode:zipcode /home/zipcode /app

USER zipcode

# Volume for persistent storage
VOLUME ["/home/zipcode/.zipcode"]

# Expose for potential future web UI
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

ENTRYPOINT ["node", "dist/index.js"]
