FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# 1. Copy everything
COPY . .

# 2. Move to backend
WORKDIR /app/backend

# 3. FIX: Update Node.js to the latest v20 to satisfy dependency requirements
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# 4. Install dependencies 
# This will also run 'npx playwright install chromium --with-deps' 
# because of your postinstall script.
RUN npm ci

# 5. Build TypeScript
RUN npx tsc

# 6. Clean up
RUN npm prune --omit=dev

EXPOSE 3000

CMD ["node", "dist/server.js"]