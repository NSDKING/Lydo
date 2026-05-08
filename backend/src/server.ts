import express, { Request, Response } from 'express';

import { handler as menuHandler } from './generateMenu.js';
import { handler as tiktokHandler } from './processTiktok.js';
import { handler as lidlHandler } from './scrapeLidlPromo.js';

import { saveUserData } from './supabaseClient.js';

const app = express();

/**
 * CLOUD CONFIG
 */
const PORT = process.env.PORT || '3000';
const HOST = '0.0.0.0';

/**
 * HEALTHCHECKS
 */
app.get('/', (_req, res) => {
  res.status(200).send('Mako Backend Online');
});

app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

/**
 * MIDDLEWARE
 */
app.use(express.json({ limit: '10mb' }));

/**
 * ROUTES
 */

// Save user profile data
app.post('/user-data', async (req: Request, res: Response) => {
  try {
    const { userId, profile } = req.body;

    if (!userId || !profile) {
      return res.status(400).json({
        error: 'Missing userId or profile payload'
      });
    }

    await saveUserData(userId, profile);

    return res.status(200).json({
      success: true
    });

  } catch (error) {
    console.error('User data save failed:', error);

    return res.status(500).json({
      error: (error as Error).message
    });
  }
});

// Lidl scraping
app.get('/lidl/promos', lidlHandler);

// AI meal generation
app.post('/menu/generate', menuHandler);

// TikTok processing
app.post('/tiktok/analyze', tiktokHandler);

/**
 * SERVER START
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
 * GRACEFUL SHUTDOWN
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});