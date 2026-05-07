FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npx tsc && npm prune --omit=dev

EXPOSE 3000
CMD ["node", "dist/server.js"]
