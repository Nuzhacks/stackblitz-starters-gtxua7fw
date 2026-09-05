import { NextResponse } from 'next/server';
import portfolio from '@/data/transactions.json';
import snapshot from '@/data/coingecko-snapshot.json';
import type { PriceMap } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const IDS = portfolio.assets.map((a) => a.coingeckoId).filter((id): id is string => Boolean(id));
const BY_ID = new Map(
  portfolio.assets.filter((a) => a.coingeckoId).map((a) => [a.coingeckoId as string, a.symbol]),
);

/**
 * Falls back to the prices implied by the imported CoinGecko snapshot so the
 * dashboard still renders (clearly marked stale) when the API is unreachable.
 */
function snapshotPrices(): PriceMap {
  const map: PriceMap = {};
  for (const [symbol, figures] of Object.entries(snapshot.assets)) {
    const price = (figures as { impliedPrice: number | null }).impliedPrice;
    if (price === null) continue;
    map[symbol] = { gbp: price, change24h: null, updatedAt: snapshot.capturedAt, stale: true };
  }
  return map;
}

export async function GET() {
  const url = new URL('https://api.coingecko.com/api/v3/simple/price');
  url.searchParams.set('ids', IDS.join(','));
  url.searchParams.set('vs_currencies', 'gbp');
  url.searchParams.set('include_24hr_change', 'true');

  const headers: Record<string, string> = { accept: 'application/json' };
  if (process.env.COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
  }

  try {
    const res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`);

    const body = (await res.json()) as Record<string, { gbp?: number; gbp_24h_change?: number }>;
    const updatedAt = new Date().toISOString();
    const prices: PriceMap = {};

    for (const [id, quote] of Object.entries(body)) {
      const symbol = BY_ID.get(id);
      if (!symbol || typeof quote.gbp !== 'number') continue;
      prices[symbol] = {
        gbp: quote.gbp,
        change24h: typeof quote.gbp_24h_change === 'number' ? quote.gbp_24h_change : null,
        updatedAt,
      };
    }

    if (Object.keys(prices).length === 0) throw new Error('No prices returned');

    // Delisted tokens, and any the lookup skipped, fall back to their imported price so the
    // portfolio total stays complete. They are marked stale so the UI can say so.
    const fallback = snapshotPrices();
    for (const [symbol, point] of Object.entries(fallback)) {
      if (!prices[symbol]) prices[symbol] = point;
    }

    return NextResponse.json({ prices, source: 'coingecko', updatedAt });
  } catch (error) {
    return NextResponse.json({
      prices: snapshotPrices(),
      source: 'snapshot',
      updatedAt: snapshot.capturedAt,
      error: error instanceof Error ? error.message : 'Price lookup failed',
    });
  }
}
