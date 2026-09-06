import type { AssetPosition, PortfolioData, PriceMap } from './types';
import { costInGbp } from './portfolio';

export interface PurchaseOutcome {
  symbol: string;
  date: string | null;
  cost: number;
  valueNow: number;
  multiple: number;
}

export interface YearOutcome {
  year: string;
  purchases: number;
  cost: number;
  valueNow: number;
  multiple: number;
}

export interface Insights {
  /** Money-weighted annual return: what each pound actually earned per year it was invested. */
  irr: number | null;
  /** Cost-weighted average time each pound has been invested, in years. */
  averageHoldYears: number;
  totalDeployed: number;
  firstPurchase: string | null;
  /** The two largest positions by value, against everything else. */
  concentration: {
    topSymbols: string[];
    topCost: number;
    topValue: number;
    restCost: number;
    restValue: number;
  } | null;
  winners: { count: number; cost: number; valueNow: number };
  losers: { count: number; cost: number; valueNow: number };
  byYear: YearOutcome[];
  best: PurchaseOutcome[];
  worst: PurchaseOutcome[];
  /** Purchases that could not be valued because the asset has no price. */
  unvalued: number;
}

/**
 * Internal rate of return on the dated cashflows plus today's value, solved by
 * bisection. Returns null when the flows never cross zero (no purchases, or a
 * total loss), where a rate has no meaning.
 */
export function moneyWeightedReturn(
  flows: { date: Date; amount: number }[],
  today: Date,
  finalValue: number,
): number | null {
  if (flows.length === 0 || finalValue <= 0) return null;
  const all = [...flows, { date: today, amount: finalValue }].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  const t0 = all[0].date.getTime();
  const years = (d: Date) => (d.getTime() - t0) / (365.25 * 86400000);
  const npv = (r: number) =>
    all.reduce((sum, f) => sum + f.amount / Math.pow(1 + r, years(f.date)), 0);

  let lo = -0.99;
  let hi = 10;
  if (npv(lo) < 0 || npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function buildInsights(
  data: PortfolioData,
  prices: PriceMap,
  positions: AssetPosition[],
  today = new Date(),
): Insights {
  const priceOf = (symbol: string) => prices[symbol]?.gbp ?? null;

  const flows: { date: Date; amount: number }[] = [];
  const purchases: PurchaseOutcome[] = [];
  let totalDeployed = 0;
  let weightedYears = 0;
  let firstPurchase: string | null = null;
  let unvalued = 0;

  for (const asset of data.assets) {
    const price = priceOf(asset.symbol);
    for (const tx of asset.transactions) {
      const cost = costInGbp(tx);
      if (!cost) continue;

      if (tx.type === 'buy') {
        totalDeployed += cost;
        if (price === null) {
          unvalued += 1;
        } else {
          purchases.push({
            symbol: asset.symbol,
            date: tx.date,
            cost,
            valueNow: tx.qty * price,
            multiple: (tx.qty * price) / cost,
          });
        }
      }

      if (!tx.date) continue;
      const date = new Date(`${tx.date}T00:00:00Z`);
      if (tx.type === 'buy') {
        flows.push({ date, amount: -cost });
        weightedYears += cost * ((today.getTime() - date.getTime()) / (365.25 * 86400000));
        if (!firstPurchase || tx.date < firstPurchase) firstPurchase = tx.date;
      } else if (tx.type === 'sell') {
        flows.push({ date, amount: cost });
      }
    }
  }

  const totalValue = positions.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const irr = moneyWeightedReturn(flows, today, totalValue);

  const ranked = [...positions].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const top = ranked.slice(0, 2);
  const rest = ranked.slice(2);
  const concentration =
    top.length === 2
      ? {
          topSymbols: top.map((p) => p.symbol),
          topCost: top.reduce((s, p) => s + p.totalCost - p.proceeds, 0),
          topValue: top.reduce((s, p) => s + (p.value ?? 0), 0),
          restCost: rest.reduce((s, p) => s + p.totalCost - p.proceeds, 0),
          restValue: rest.reduce((s, p) => s + (p.value ?? 0), 0),
        }
      : null;

  const up = purchases.filter((p) => p.multiple > 1);
  const down = purchases.filter((p) => p.multiple <= 1);
  const tally = (list: PurchaseOutcome[]) => ({
    count: list.length,
    cost: list.reduce((s, p) => s + p.cost, 0),
    valueNow: list.reduce((s, p) => s + p.valueNow, 0),
  });

  const years = new Map<string, YearOutcome>();
  for (const p of purchases) {
    const year = p.date ? p.date.slice(0, 4) : 'Undated';
    const row = years.get(year) ?? { year, purchases: 0, cost: 0, valueNow: 0, multiple: 0 };
    row.purchases += 1;
    row.cost += p.cost;
    row.valueNow += p.valueNow;
    years.set(year, row);
  }
  const byYear = Array.from(years.values())
    .map((r) => ({ ...r, multiple: r.cost ? r.valueNow / r.cost : 0 }))
    .sort((a, b) => a.year.localeCompare(b.year));

  const sorted = [...purchases].sort((a, b) => b.multiple - a.multiple);

  return {
    irr,
    averageHoldYears: totalDeployed ? weightedYears / totalDeployed : 0,
    totalDeployed,
    firstPurchase,
    concentration,
    winners: tally(up),
    losers: tally(down),
    byYear,
    best: sorted.slice(0, 3),
    worst: sorted.slice(-3).reverse(),
    unvalued,
  };
}

/** Deepest peak-to-trough fall in the weekly history, and how long the portfolio sat below water. */
export function historyStats(series: [string, number, number][]) {
  let peak = 0;
  let peakDate = '';
  let worst = { from: '', to: '', peak: 0, trough: 0, pct: 0 };
  let underwater = 0;

  for (const [date, value, invested] of series) {
    if (value > peak) {
      peak = value;
      peakDate = date;
    } else if (peak > 0) {
      const pct = (value / peak - 1) * 100;
      if (pct < worst.pct) worst = { from: peakDate, to: date, peak, trough: value, pct };
    }
    if (value < invested) underwater += 1;
  }

  const allTimeHigh = series.reduce((a, b) => (b[1] > a[1] ? b : a), series[0]);
  return {
    worstDrawdown: worst,
    underwaterWeeks: underwater,
    totalWeeks: series.length,
    allTimeHigh: { date: allTimeHigh[0], value: allTimeHigh[1] },
  };
}
