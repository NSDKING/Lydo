# Use the official Playwright image which includes all browser dependencies
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# Since Root Directory is /backend, package.json is now in the current folder (.)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the files from the current folder
COPY tsconfig.json ./
COPY src ./src

# Build the TypeScript code and remove devDependencies to save space
RUN npx tsc && npm prune --omit=dev

# Expose the port (Railway will override this with its own PORT variable)
EXPOSE 3000

# Start the server from the compiled dist folder
CMD ["node", "dist/server.js"]