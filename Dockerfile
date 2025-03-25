# Stage 1: Build the static site
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Build arguments for environment variables
ARG VITE_API_HUB
ARG VITE_API_ATRACE

# Set environment variables
ENV VITE_API_HUB=$VITE_API_HUB
ENV VITE_API_ATRACE=$VITE_API_ATRACE

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the static site
RUN npm run generate

# Stage 2: Serve the static site with Nginx
FROM nginx:alpine

# Copy the built static files to Nginx's default directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]