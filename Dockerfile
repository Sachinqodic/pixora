# Development Dockerfile with hot-reload
FROM node:20-alpine

# Install ffmpeg for video processing
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /pixora-app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for nodemon)
RUN npm install

# Copy application code
COPY . .

# Create temp directory for file uploads
RUN mkdir -p temp

# Expose the application port
EXPOSE 3003

# Set development environment
ENV NODE_ENV=development

# Start the application with nodemon for hot-reload
CMD ["npm", "run", "dev"]
