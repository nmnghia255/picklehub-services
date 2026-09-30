# Development Dockerfile for tournament-service
# Minimum node version for Prisma 6 is 20.9.0
FROM node:20.20-alpine

# Install build dependencies for canvas (node-canvas)
RUN apk add --no-cache \
    build-base \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    freetype-dev \
    python3

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies with cache
RUN --mount=type=cache,id=global-npm-cache,sharing=locked,target=/root/.npm npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose port
EXPOSE 8008

# Start in development mode
CMD ["npm", "run", "start:dev"]