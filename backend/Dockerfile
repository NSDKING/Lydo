FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# Copy EVERYTHING from the Railway root into the Docker image
# Since Railway is rooted at /backend, this copies everything INSIDE /backend
COPY . .

# Install dependencies
RUN npm ci

# Run the build
RUN npx tsc && npm prune --omit=dev

EXPOSE 3000
CMD ["node", "dist/server.js"]