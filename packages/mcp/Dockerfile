# Generated for Smithery deployment
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --ignore-scripts

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runtime
WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Use stdio for MCP
ENTRYPOINT ["node", "dist/index.js"]

