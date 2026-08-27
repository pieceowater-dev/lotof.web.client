# Stage 1: Build the Nuxt application
# Node 20+ required: sharp's linuxmusl-x64 prebuild (added for on-the-fly
# publication image re-encoding) has no compatible build for Node 18 on
# Alpine and throws at module load, 500ing every publication image in prod.
FROM node:20-alpine AS builder

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
# No default on purpose: pass --build-arg NUXT_PUBLIC_SITE_URL=https://<host> per
# deployment. Left empty, nuxt.config.ts falls back to DEFAULT_SITE_URL
# (utils/siteUrl.ts) -- the one place the platform domain is written as a literal.
ARG NUXT_PUBLIC_SITE_URL
ENV NUXT_PUBLIC_SITE_URL=$NUXT_PUBLIC_SITE_URL

# Build the Nuxt application (SSR with Nitro server)
RUN npm run build

# Stage 2: Run Nitro server
FROM node:20-alpine

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/.output /app/.output

# Nitro's static file-tracer resolves sharp's *code* into
# .output/server/node_modules but can't statically follow its runtime
# platform-detection lookup (it picks its native binary package, e.g.
# @img/sharp-linuxmusl-x64, based on process.platform/arch/libc at
# require-time, not via a literal require() call a tracer can see) -- so
# the copied node_modules/sharp ends up present but incomplete, and a
# fresh `npm install` layered on top of it treats the package as already
# satisfied instead of fixing it. .output/server/package.json (which
# Nitro also generates) is accurate though, so wipe the partial trace and
# install for real, in the actual target platform, from that.
RUN rm -rf /app/.output/server/node_modules \
  && cd /app/.output/server \
  && npm install --omit=dev

# Expose port 3000 (Nitro default)
EXPOSE 3000

# Set runtime environment variables
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

# Start Nitro server
CMD ["node", ".output/server/index.mjs"]