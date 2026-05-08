# Try a newer version of Playwright which likely has a updated Node 20 or 22
FROM mcr.microsoft.com/playwright:v1.45.0-jammy
WORKDIR /app
# Copy only package files first to cache dependencies
COPY package*.json ./
RUN npm ci

# Now copy the rest of the code
COPY . .

# Build the app
RUN npx tsc

# Prune dev dependencies last
RUN npm prune --omit=dev