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

# Public runtime config that also needs to be available at build time: the
# home page and /feed are prerendered (see nuxt.config.ts prerender.routes),
# so whatever these resolve to here gets baked into that static HTML
# permanently -- unlike every other (SSR) route, they never re-read the
# container's runtime env vars again after this build.
ARG NUXT_PUBLIC_AMPLITUDE_API_KEY
ENV NUXT_PUBLIC_AMPLITUDE_API_KEY=$NUXT_PUBLIC_AMPLITUDE_API_KEY
ARG NUXT_PUBLIC_SITE_URL=https://lota.tools
ENV NUXT_PUBLIC_SITE_URL=$NUXT_PUBLIC_SITE_URL

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