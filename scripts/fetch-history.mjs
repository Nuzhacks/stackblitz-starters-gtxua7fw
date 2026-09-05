#!/usr/bin/env node
/**
 * Regenerates data/history.json: weekly portfolio value and cumulative net invested
 * back to 2021, in GBP.
 *
 *   node scripts/fetch-history.mjs
 *
 * For each asset it pulls that coin's daily GBP price from CoinGecko, then applies
 * the holdings actually owned in each week, so the line reflects both price moves
 * and purchases. Transactions with no recorded date cannot be placed on a timeline
 * and are skipped; the file records how much cost that leaves out.
 *
 * Set COINGECKO_API_KEY to use a free demo key if you hit rate limits.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const START = Date.UTC(2021, 0, 1);
const WEEK = 7 * 86400000;

const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function costInGbp(tx) {
  if (typeof tx.costGbp === 'number') return tx.costGbp;
  if (tx.currency !== 'GBP' && tx.fxToGbp) return tx.cost / tx.fxToGbp;
  return tx.cost;
}

function signedQty(tx) {
  return tx.type === 'sell' || tx.type === 'transfer_out' ? -tx.qty : tx.qty;
}

async function fetchPrices(id, from, to) {
  const url = new URL(`https://api.coingecko.com/api/v3/coins/${id}/market_chart/range`);
  url.searchParams.set('vs_currency', 'gbp');
  url.searchParams.set('from', String(from));
  url.searchParams.set('to', String(to));
  url.searchParams.set('interval', 'daily');

  const headers = { accept: 'application/json' };
  if (process.env.COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers });
    if (res.ok) {
      const body = await res.json();
      const map = {};
      for (const [ts, price] of body.prices ?? []) map[day(ts)] = price;
      return map;
    }
    if (res.status === 429) {
      await sleep(2000 * (attempt + 1)); // back off and retry on rate limit
      continue;
    }
    throw new Error(`${id}: CoinGecko responded ${res.status}`);
  }
  throw new Error(`${id}: still rate limited after retries`);
}

const portfolio = JSON.parse(await readFile(join(ROOT, 'data/transactions.json'), 'utf8'));

const tracked = [];
let undatedCost = 0;
const skipped = [];
for (const asset of portfolio.assets) {
  const dated = asset.transactions.filter((t) => t.date);
  for (const t of asset.transactions) {
    if (!t.date && t.type === 'buy') undatedCost += costInGbp(t);
  }
  if (!asset.coingeckoId || dated.length === 0) {
    skipped.push(asset.symbol);
    continue;
  }
  tracked.push({ symbol: asset.symbol, id: asset.coingeckoId, transactions: dated });
}

const from = Math.floor(Date.UTC(2020, 11, 1) / 1000);
const to = Math.floor(Date.now() / 1000);
const priceBySymbol = {};

for (const [i, asset] of tracked.entries()) {
  process.stdout.write(`\r[${i + 1}/${tracked.length}] ${asset.symbol.padEnd(8)}`);
  priceBySymbol[asset.symbol] = await fetchPrices(asset.id, from, to);
  await sleep(300); // stay well inside the free tier's rate limit
}
process.stdout.write('\n');

const series = [];
const lastSeen = {};
for (let ms = START; ms <= Date.now(); ms += WEEK) {
  const d = day(ms);
  let value = 0;
  let invested = 0;
  for (const asset of tracked) {
    let qty = 0;
    for (const tx of asset.transactions) {
      if (tx.date > d) continue;
      qty += signedQty(tx);
      if (tx.type === 'buy') invested += costInGbp(tx);
      else if (tx.type === 'sell') invested -= costInGbp(tx);
    }
    const prices = priceBySymbol[asset.symbol];
    if (prices[d] !== undefined) lastSeen[asset.symbol] = prices[d];
    if (qty === 0) continue;
    // Carry the last known price forward across weekends, gaps and delistings.
    const price = prices[d] !== undefined ? prices[d] : lastSeen[asset.symbol];
    if (price !== undefined) value += qty * price;
  }
  series.push([d, Number(value.toFixed(2)), Number(invested.toFixed(2))]);
}

const out = {
  $comment:
    'Weekly portfolio value and cumulative net invested, in GBP. Value uses each coin’s daily GBP price from CoinGecko applied to the holdings actually owned that week, so it reflects both price moves and purchases. Regenerate with scripts/fetch-history.mjs.',
  generatedAt: day(Date.now()),
  currency: 'GBP',
  interval: 'weekly',
  assetsIncluded: tracked.length,
  excluded: `${skipped.join(', ')} have no recorded transaction dates, so they cannot be placed on a timeline. That leaves £${undatedCost.toFixed(2)} of cost out of this chart.`,
  columns: ['date', 'value', 'netInvested'],
  series,
};

await writeFile(join(ROOT, 'data/history.json'), `${JSON.stringify(out)}\n`);
console.log(`Wrote ${series.length} weekly points for ${tracked.length} assets.`);
if (skipped.length) console.log(`Skipped (no dated transactions): ${skipped.join(', ')}`);
