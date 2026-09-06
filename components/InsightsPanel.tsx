'use client';

import { useMemo } from 'react';
import type { AssetPosition, PortfolioData, PriceMap } from '@/lib/types';
import { buildInsights, historyStats } from '@/lib/insights';
import { money } from '@/lib/format';

/** Emphasis pair from the validated dark palette: the two big holdings lit, the rest recessive. */
const TOP = '#199e70';
const REST = '#4b5563';

export default function InsightsPanel({
  data,
  prices,
  positions,
  history,
}: {
  data: PortfolioData;
  prices: PriceMap;
  positions: AssetPosition[];
  history: [string, number, number][];
}) {
  const insights = useMemo(
    () => buildInsights(data, prices, positions),
    [data, prices, positions],
  );
  const past = useMemo(() => historyStats(history), [history]);

  if (positions.every((p) => p.price === null)) return null;

  const { concentration: c, winners, losers } = insights;

  const moneyShare = c ? (c.topCost / (c.topCost + c.restCost)) * 100 : 0;
  const valueShare = c ? (c.topValue / (c.topValue + c.restValue)) * 100 : 0;

  return (
    <section className="mb-6 rounded-2xl border border-ink-500 bg-ink-800 p-5">
      <h2 className="text-lg font-semibold">What the numbers say</h2>
      <p className="mt-1 text-sm text-slate-400">
        Recalculated from live prices every time this page refreshes.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-ink-500 bg-ink-700 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Return per year</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {insights.irr === null ? '—' : `${(insights.irr * 100).toFixed(1)}%`}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Money-weighted, so it counts when each pound went in. The average pound has been
            invested {insights.averageHoldYears.toFixed(1)} years.
          </p>
        </div>

        <div className="rounded-xl border border-ink-500 bg-ink-700 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Purchases in profit</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {winners.count} of {winners.count + losers.count}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Winners turned {money(winners.cost, { round: true })} into{' '}
            {money(winners.valueNow, { round: true })}. Losers turned{' '}
            {money(losers.cost, { round: true })} into {money(losers.valueNow, { round: true })}.
          </p>
        </div>

        <div className="rounded-xl border border-ink-500 bg-ink-700 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Worst fall so far</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            −{Math.abs(past.worstDrawdown.pct).toFixed(0)}%
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {money(past.worstDrawdown.peak, { round: true })} down to{' '}
            {money(past.worstDrawdown.trough, { round: true })}. Worth less than you put in for{' '}
            {Math.round((past.underwaterWeeks / past.totalWeeks) * 100)}% of all weeks.
          </p>
        </div>
      </div>

      {c && (
        <div className="mt-5 rounded-xl border border-ink-500 bg-ink-700 p-4">
          <p className="text-sm font-medium text-slate-200">
            {c.topSymbols.join(' and ')} against the other {positions.length - 2}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {moneyShare.toFixed(0)}% of the money, {valueShare.toFixed(0)}% of the value. The same
            split shown twice: what you put in, and what it is worth now.
          </p>

          <div className="mt-3 space-y-3">
            <SplitBar
              label="Money you put in"
              topPct={moneyShare}
              topLabel={`${c.topSymbols.join(' + ')} ${money(c.topCost, { round: true })}`}
              restLabel={`Others ${money(c.restCost, { round: true })}`}
            />
            <SplitBar
              label="What it is worth now"
              topPct={valueShare}
              topLabel={`${c.topSymbols.join(' + ')} ${money(c.topValue, { round: true })}`}
              restLabel={`Others ${money(c.restValue, { round: true })}`}
            />
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {c.topSymbols.join(' + ')} turned {money(c.topCost, { round: true })} into{' '}
            <span className="text-gain">{money(c.topValue, { round: true })}</span> (
            {(c.topValue / c.topCost).toFixed(2)}x). Everything else turned{' '}
            {money(c.restCost, { round: true })} into{' '}
            <span className={c.restValue >= c.restCost ? 'text-gain' : 'text-loss'}>
              {money(c.restValue, { round: true })}
            </span>{' '}
            ({(c.restValue / c.restCost).toFixed(2)}x).
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-200">Every pound, by the year you spent it</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1 font-medium">Year</th>
                <th className="py-1 text-right font-medium">Spent</th>
                <th className="py-1 text-right font-medium">Worth now</th>
                <th className="py-1 text-right font-medium">Multiple</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {insights.byYear.map((r) => (
                <tr key={r.year} className="border-t border-ink-600/60">
                  <td className="py-1.5 text-slate-400">{r.year}</td>
                  <td className="py-1.5 text-right text-slate-300">{money(r.cost, { round: true })}</td>
                  <td className="py-1.5 text-right text-slate-300">
                    {money(r.valueNow, { round: true })}
                  </td>
                  <td
                    className={`py-1.5 text-right ${r.multiple >= 1 ? 'text-gain' : 'text-loss'}`}
                  >
                    {r.multiple.toFixed(2)}x
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-200">Best and worst single buys</h3>
          <ul className="space-y-1 text-xs">
            {insights.best.map((p, i) => (
              <li key={`b${i}`} className="flex items-baseline justify-between gap-2 border-t border-ink-600/60 py-1.5">
                <span className="text-slate-300">
                  <span className="font-semibold">{p.symbol}</span>{' '}
                  <span className="text-slate-500">{p.date ?? 'date unknown'}</span>
                </span>
                <span className="tnum text-gain">
                  {money(p.cost, { round: true })} → {money(p.valueNow, { round: true })} ·{' '}
                  {p.multiple.toFixed(2)}x
                </span>
              </li>
            ))}
            {insights.worst.map((p, i) => (
              <li key={`w${i}`} className="flex items-baseline justify-between gap-2 border-t border-ink-600/60 py-1.5">
                <span className="text-slate-300">
                  <span className="font-semibold">{p.symbol}</span>{' '}
                  <span className="text-slate-500">{p.date ?? 'date unknown'}</span>
                </span>
                <span className="tnum text-loss">
                  {money(p.cost, { round: true })} → {money(p.valueNow, { round: true })} ·{' '}
                  {p.multiple < 0.01 ? '<0.01' : p.multiple.toFixed(2)}x
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Per-purchase figures value each buy as if still held, so the{' '}
        {money(positions.reduce((s, p) => s + p.proceeds, 0), { round: true })} you have sold is not
        deducted from them.
        {insights.unvalued > 0 && ` ${insights.unvalued} purchase(s) have no price and are left out.`}
      </p>
    </section>
  );
}

function SplitBar({
  label,
  topPct,
  topLabel,
  restLabel,
}: {
  label: string;
  topPct: number;
  topLabel: string;
  restLabel: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="tnum text-slate-500">
          {topPct.toFixed(0)}% / {(100 - topPct).toFixed(0)}%
        </span>
      </div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded">
        <div style={{ width: `${topPct}%`, background: TOP }} />
        <div style={{ width: `${100 - topPct}%`, background: REST }} />
      </div>
      {/* Labels sit outside the bars so they can never be clipped by a narrow segment. */}
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 text-[11px]">
        <span className="flex items-center gap-1.5 text-slate-300">
          <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: TOP }} />
          {topLabel}
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: REST }} />
          {restLabel}
        </span>
      </div>
    </div>
  );
}
