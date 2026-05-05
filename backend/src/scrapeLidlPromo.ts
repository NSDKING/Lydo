import { chromium } from 'playwright';
import { saveLidlPromos } from './supabaseClient';

export interface LidlPromo {
  title: string;
  price: string;
  validFrom?: string;
  validTo?: string;
  imageUrl?: string;
  supermarket: 'Lidl';
  sourceUrl: string;
}

export async function scrapeLidlPromo(region = process.env.LIDL_REGION || 'de'): Promise<LidlPromo[]> {
  const url = `https://www.lidl.${region}/`; // adjust if Lidl uses country subdomains
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  const promos = await page.$$eval('[data-testid="promo-card"], .promo-card, .product-card', (cards) => {
    return cards.map((card) => {
      const title = card.querySelector('h3, h2, .title, .product-name')?.textContent?.trim() || '';
      const price = card.querySelector('.price, .product-price, .promo-price')?.textContent?.trim() || '';
      const imageUrl = card.querySelector('img')?.getAttribute('src') || '';
      return {
        title,
        price,
        imageUrl,
      };
    });
  });

  await browser.close();

  const normalized = promos
    .filter((promo) => promo.title && promo.price)
    .map((promo) => ({
      ...promo,
      supermarket: 'Lidl' as const,
      sourceUrl: url,
    }));

  await saveLidlPromos(normalized);
  return normalized;
}

export async function handler(req: any, res: any) {
  try {
    const promos = await scrapeLidlPromo();
    res.status(200).json({ promos });
  } catch (error) {
    console.error('Lidl scrape failed', error);
    res.status(500).json({ error: (error as Error).message });
  }
}
