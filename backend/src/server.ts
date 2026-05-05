import express from 'express';
import { handler as menuHandler } from './generateMenu';
import { handler as tiktokHandler } from './processTiktok';
import { handler as lidlHandler } from './scrapeLidlPromo';
import { saveUserData } from './supabaseClient';

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'mako-backend' });
});

app.post('/user-data', async (req, res) => {
  try {
    const { userId, profile } = req.body;
    if (!userId || !profile) {
      return res.status(400).json({ error: 'Missing userId or profile payload' });
    }

    await saveUserData(userId, profile);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('User data save failed', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/lidl/promos', async (_req, res) => {
  return lidlHandler(_req, res);
});

app.post('/menu/generate', async (req, res) => {
  return menuHandler(req, res);
});

app.post('/tiktok/analyze', async (req, res) => {
  return tiktokHandler(req, res);
});

app.listen(port, () => {
  console.log(`Mako backend listening on http://localhost:${port}`);
});
