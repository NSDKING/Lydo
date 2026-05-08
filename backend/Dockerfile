FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# 1. Set the working directory to /app
WORKDIR /app

# 2. Copy the entire repository content
COPY . .

# 3. Move INTO the backend folder where package.json lives
WORKDIR /app/backend

# 4. Install dependencies (this will trigger your playwright postinstall too)
RUN npm ci

# 5. Run the build (tsc) inside /app/backend
RUN npx tsc

# 6. Prune dev dependencies to keep the image slim
RUN npm prune --omit=dev

EXPOSE 3000

# 7. Start the server from the current directory (which is /app/backend)
CMD ["node", "dist/server.js"]