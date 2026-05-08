import express, { Request, Response } from 'express'; 
// Ensure your tsconfig.json is set to 'NodeNext' or 'Node16' for these imports
import { handler as menuHandler } from './generateMenu.js';
import { handler as tiktokHandler } from './processTiktok.js';
import { handler as lidlHandler } from './scrapeLidlPromo.js';
import { saveUserData } from './supabaseClient.js';

const app = express();

/**
 * PORT SETUP
 * Railway provides the PORT environment variable. 
 * Binding to 0.0.0.0 is critical for containerized environments.
 */
const port = Number(process.env.PORT) || 3000;
const host = '0.0.0.0'; 

app.use(express.json({ limit: '10mb' }));

/**
 * HEALTHCHECK ENDPOINT
 * This must respond with a 200 OK within the timeout window (default 30s).
 */
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'mako-backend' 
  });
});

app.post('/user-data', async (req: Request, res: Response) => {
  try {
    const { userId, profile } = req.body;
    if (!userId || !profile) {
      return res.status(400).json({ error: 'Missing userId or profile payload' });
    }

    await saveUserData(userId, profile);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('User data save failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Scraper/Heavy Task Routes
app.get('/lidl/promos', lidlHandler);
app.post('/menu/generate', menuHandler);
app.post('/tiktok/analyze', tiktokHandler);

/**
 * SERVER INIT
 * Explicitly binding to host '0.0.0.0' ensures the Railway healthchecker 
 * can reach the service via IPv4.
 */
const server = app.listen(port, host, () => {
  console.log('--------------------------------------------------');
  console.log(`🚀 Mako backend is live!`);
  console.log(`📡 Listening on: http://${host}:${port}`);
  console.log(`🏥 Healthcheck: http://${host}:${port}/health`);
  console.log('--------------------------------------------------');
});

// Handle graceful shutdown for the container
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});