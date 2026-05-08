FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# We are already inside the 'backend' folder thanks to Railway's Root Dir setting
COPY package*.json ./
RUN npm ci

# Copy files relative to the current folder
COPY tsconfig.json ./
COPY src ./src

# This runs the compiler and cleans up
RUN npx tsc && npm prune --omit=dev

EXPOSE 3000
CMD ["node", "dist/server.js"]