import express, { Request, Response } from 'express'; 
// Ensure your tsconfig.json has "moduleResolution": "NodeNext"
import { handler as menuHandler } from './generateMenu.js';
import { handler as tiktokHandler } from './processTiktok.js';
import { handler as lidlHandler } from './scrapeLidlPromo.js';
import { saveUserData } from './supabaseClient.js';

const app = express();

/**
 * 1. CLOUD-READY CONFIG
 * Railway sets the PORT env var. We must bind to 0.0.0.0.
 */
const PORT = process.env.PORT || '3000';
const HOST = '0.0.0.0'; 

/**
 * 2. IMMEDIATE HEALTHCHECK
 * Defined before any other middleware or routes to ensure 
 * Railway gets a fast 200 OK response.
 */
// Some health checkers default to / instead of /health
app.get('/', (_req, res) => {
  res.status(200).send('Mako Backend Online');
});

// Keep this one too just in case
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

/**
 * 3. MIDDLEWARE
 */
app.use(express.json({ limit: '10mb' }));

/**
 * 4. APPLICATION ROUTES
 */

// Supabase User Data Route
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

// Scraping & Processing Routes
app.get('/lidl/promos', lidlHandler);
app.post('/menu/generate', menuHandler);
app.post('/tiktok/analyze', tiktokHandler);

/**
 * 5. SERVER INITIALIZATION
 */
const server = app.listen(Number(PORT), HOST, () => {
  console.log(`
  🚀 Mako Backend Initialized
  ---------------------------------
  Local:   http://localhost:${PORT}
  Network: http://${HOST}:${PORT}
  Health:  /health
  ---------------------------------
  `);
});

/**
 * 6. GRACEFUL SHUTDOWN
 * Helps Railway restart the container without hanging connections.
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});