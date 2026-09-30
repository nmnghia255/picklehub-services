# Development Dockerfile for group-service
FROM node:20-alpine

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
EXPOSE 8003

# Start in development mode (compiles automatically)
CMD ["npm", "run", "start:dev"]
