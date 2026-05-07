FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npx playwright install chromium --with-deps

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

EXPOSE 3000
CMD ["node", "dist/server.js"]
