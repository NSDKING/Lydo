FROM mcr.microsoft.com/playwright:v1.45.0-jammy

WORKDIR /app

# Copy dependency files first
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --omit=dev

# Railway port
EXPOSE 3000

# Start backend
CMD ["node", "dist/server.js"]