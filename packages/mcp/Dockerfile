# Dockerfile for Smithery container deployment
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Expose for HTTP transport (Smithery wraps stdio -> http)
EXPOSE 8000

# Run the CLI entry point
CMD ["node", "dist/cli.js"]
