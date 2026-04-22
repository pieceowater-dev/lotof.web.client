# Stage 1: Build the Nuxt application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the Nuxt application (SSR with Nitro server)
RUN npm run build

# Stage 2: Run Nitro server
FROM node:18-alpine

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/.output /app/.output

# Expose port 3000 (Nitro default)
EXPOSE 3000

# Set runtime environment variables
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

# Start Nitro server
CMD ["node", ".output/server/index.mjs"]