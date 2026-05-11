// Set EXPO_PUBLIC_API_URL in your .env file to point at the Railway deployment.
// During local development it falls back to localhost.
export const API_URL =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? 'http://localhost:3000';
