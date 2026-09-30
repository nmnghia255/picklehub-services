# Development Dockerfile for user-service
# Minimum node version for Prisma 6 is 20.9.0
FROM node:20.20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN --mount=type=cache,id=global-npm-cache,sharing=locked,target=/root/.npm npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose port
EXPOSE 8006

# Start in development mode (compiles automatically)
CMD ["npm", "run", "start:dev"]