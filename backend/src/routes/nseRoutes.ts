import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BASE_HEADERS: Record<string, string> = {
  'User-Agent':      UA,
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer':         'https://www.nseindia.com/',
  'Origin':          'https://www.nseindia.com',
  'Sec-Fetch-Dest':  'empty',
  'Sec-Fetch-Mode':  'cors',
  'Sec-Fetch-Site':  'same-origin',
};

let sessionCookies = '';
let sessionExpiry  = 0;

async function refreshSession(): Promise<void> {
  const res = await fetch('https://www.nseindia.com', {
    headers: {
      'User-Agent':      UA,
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  // Node 20: headers.getSetCookie() returns string[]
  const raw: string[] = (res.headers as unknown as { getSetCookie?(): string[] }).getSetCookie?.() ?? [];
  sessionCookies = raw.map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
  sessionExpiry  = Date.now() + 8 * 60 * 1000;
}

interface CacheEntry { data: unknown; ts: number }
const dataCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchNse(path: string): Promise<unknown> {
  if (!sessionCookies || Date.now() > sessionExpiry) await refreshSession();

  const url = `https://www.nseindia.com${path}`;
  let res   = await fetch(url, { headers: { ...BASE_HEADERS, Cookie: sessionCookies } });

  // If NSE returned HTML the session has expired — refresh once and retry
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) {
    await refreshSession();
    res = await fetch(url, { headers: { ...BASE_HEADERS, Cookie: sessionCookies } });
  }

  if (!res.ok) throw new Error(`NSE responded with ${res.status}`);
  return res.json();
}

// GET /api/nse/live?index=NIFTY+500
router.get('/live', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const index    = ((req.query.index as string | undefined) ?? 'NIFTY 500').trim();
    const cacheKey = `live_${index}`;

    const entry = dataCache.get(cacheKey);
    if (entry && Date.now() - entry.ts < CACHE_TTL) {
      res.setHeader('X-Cache', 'HIT');
      res.json({ data: entry.data, cached_at: new Date(entry.ts).toISOString() });
      return;
    }

    const data = await fetchNse(`/api/equity-stockIndices?index=${encodeURIComponent(index)}`);
    dataCache.set(cacheKey, { data, ts: Date.now() });

    res.setHeader('X-Cache', 'MISS');
    res.json({ data, cached_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

export default router;
