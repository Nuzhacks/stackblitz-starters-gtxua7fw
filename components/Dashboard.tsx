'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PortfolioData, PriceMap } from '@/lib/types';
import { buildSummary, costInGbp } from '@/lib/portfolio';
import { money, originalAmount, pct, qty as fmtQty, shortDate, signedMoney, timeAgo } from '@/lib/format';
import { evaluateAlert, loadAlerts, saveAlerts, trackPeaks, type Alert } from '@/lib/alerts';
import AlertsPanel from './AlertsPanel';
import HistoryChart from './HistoryChart';
import InsightsPanel from './InsightsPanel';
import history from '@/data/history.json';

const REFRESH_MS = 60_000;

export default function Dashboard({ data }: { data: PortfolioData }) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [source, setSource] = useState<'coingecko' | 'snapshot' | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notificationState, setNotificationState] =
    useState<NotificationPermission | 'unsupported'>('default');
  const [now, setNow] = useState(() => Date.now());

  // Which alerts were already firing, so a notification fires once per crossing.
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setAlerts(loadAlerts());
    setNotificationState(
      typeof window !== 'undefined' && 'Notification' in window
        ? Notification.permission
        : 'unsupported',
    );
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/prices', { cache: 'no-store' });
      const body = await res.json();
      setPrices(body.prices ?? {});
      setSource(body.source ?? null);
    } catch {
      setSource('snapshot');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Re-render the "updated Xs ago" label without refetching.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const summary = useMemo(() => buildSummary(data, prices), [data, prices]);

  // `now` ticks purely so this relative label refreshes without a refetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updatedLabel = useMemo(() => timeAgo(summary.updatedAt), [summary.updatedAt, now]);

  const updateAlerts = useCallback((next: Alert[]) => {
    setAlerts(next);
    saveAlerts(next);
  }, []);

  // Track trailing-stop peaks and notify on newly firing alerts.
  useEffect(() => {
    if (alerts.length === 0 || summary.pricedCount === 0) return;

    const withPeaks = trackPeaks(alerts, summary.positions);
    if (withPeaks !== alerts) {
      setAlerts(withPeaks);
      saveAlerts(withPeaks);
      return;
    }

    const stillFiring = new Set<string>();
    for (const alert of alerts) {
      if (!alert.enabled) continue;
      const position = summary.positions.find((p) => p.symbol === alert.symbol);
      const evaluation = evaluateAlert(alert, position);
      if (!evaluation.firing) continue;
      stillFiring.add(alert.id);
      if (firedRef.current.has(alert.id)) continue;
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`${alert.symbol} exit alert`, { body: evaluation.message, tag: alert.id });
      }
    }
    firedRef.current = stillFiring;
  }, [alerts, summary]);

  const firing = useMemo(
    () =>
      alerts
        .filter((a) => a.enabled)
        .map((a) => evaluateAlert(a, summary.positions.find((p) => p.symbol === a.symbol)))
        .filter((e) => e.firing),
    [alerts, summary],
  );

  function enableNotifications() {
    if (!('Notification' in window)) return;
    Notification.requestPermission().then(setNotificationState);
  }

  const staleSymbols = useMemo(
    () => summary.positions.filter((p) => p.priceStale).map((p) => p.symbol),
    [summary],
  );

  const plColour = summary.totalProfitLoss >= 0 ? 'text-gain' : 'text-loss';
  const dayColour = summary.change24hValue >= 0 ? 'text-gain' : 'text-loss';

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-1 text-sm text-slate-400">
            {source === 'snapshot' ? (
              <span className="text-amber-400">
                Live prices unavailable — showing the prices from your imported snapshot
              </span>
            ) : (
              <>Prices from CoinGecko, updated {updatedLabel}</>
            )}
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            refresh();
          }}
          className="rounded-lg border border-ink-500 px-4 py-2 text-sm text-slate-200 hover:bg-ink-600 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {firing.length > 0 && (
        <div className="mb-6 rounded-2xl border border-emerald-500/60 bg-emerald-500/10 p-4">
          <h2 className="text-sm font-semibold text-emerald-300">
            {firing.length} alert{firing.length > 1 ? 's' : ''} triggered
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-emerald-100">
            {firing.map((e) => (
              <li key={e.alert.id}>
                {e.message}
                {e.alert.note && <span className="text-emerald-300/70"> — {e.alert.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Portfolio value" value={money(summary.totalValue)} tone="text-white" big />
        <Stat
          label="Total profit / loss"
          value={signedMoney(summary.totalProfitLoss)}
          sub={pct(summary.totalProfitLossPct)}
          tone={plColour}
          big
        />
        <Stat
          label="24 hour move"
          value={signedMoney(summary.change24hValue)}
          sub={pct(summary.change24hPct)}
          tone={dayColour}
        />
        <Stat
          label="Net invested"
          value={money(summary.totalNetCost)}
          sub={`${money(summary.totalCost)} in, ${money(summary.totalProceeds)} taken out`}
          tone="text-slate-200"
        />
      </section>

      <div className="mb-6 flex h-2.5 overflow-hidden rounded-full bg-ink-700">
        {summary.positions.map((p) =>
          p.allocationPct === null ? null : (
            <div
              key={p.symbol}
              title={`${p.symbol} ${p.allocationPct.toFixed(1)}%`}
              style={{ width: `${p.allocationPct}%`, background: p.colour }}
            />
          ),
        )}
      </div>

      <HistoryChart series={history.series as [string, number, number][]} />

      <InsightsPanel
        data={data}
        prices={prices}
        positions={summary.positions}
        history={history.series as [string, number, number][]}
      />

      <section className="mb-6 overflow-x-auto rounded-2xl border border-ink-500 bg-ink-800">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-ink-500 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Asset</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
              <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">24h</th>
              <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Avg net cost</th>
              <th className="px-4 py-3 text-right font-medium">Value</th>
              <th className="px-4 py-3 text-right font-medium">Profit / loss</th>
              <th className="w-8 px-2 py-3" />
            </tr>
          </thead>
          {summary.positions.map((p) => {
            const open = expanded === p.symbol;
            return (
              <tbody key={p.symbol} className="border-b border-ink-600 last:border-0">
                <tr
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? null : p.symbol)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpanded(open ? null : p.symbol);
                    }
                  }}
                  className="cursor-pointer hover:bg-ink-700 focus:bg-ink-700 focus:outline-none"
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: p.colour }}
                      />
                      <span className="font-semibold">{p.symbol}</span>
                      <span className="hidden text-slate-500 sm:inline">{p.name}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500 tnum">
                      {fmtQty(p.qty, p.symbol)}
                      {p.allocationPct !== null && ` \u00b7 ${p.allocationPct.toFixed(1)}%`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tnum">
                    {money(p.price)}
                    {p.priceStale && p.price !== null && (
                      <span
                        className="ml-1 cursor-help text-amber-500"
                        title="No live price — using the price from your imported snapshot"
                      >
                        *
                      </span>
                    )}
                  </td>
                  <td
                    className={`hidden px-4 py-3 text-right tnum sm:table-cell ${
                      (p.change24h ?? 0) >= 0 ? 'text-gain' : 'text-loss'
                    }`}
                  >
                    {pct(p.change24h)}
                  </td>
                  <td className="hidden px-4 py-3 text-right text-slate-400 tnum md:table-cell">
                    {money(p.averageNetCost)}
                  </td>
                  <td className="px-4 py-3 text-right tnum">{money(p.value)}</td>
                  <td
                    className={`px-4 py-3 text-right tnum ${
                      (p.profitLoss ?? 0) >= 0 ? 'text-gain' : 'text-loss'
                    }`}
                  >
                    {signedMoney(p.profitLoss)}
                    <span className="block text-xs opacity-80">{pct(p.profitLossPct)}</span>
                  </td>
                  <td className="px-2 py-3 text-slate-500">{open ? '\u25b4' : '\u25be'}</td>
                </tr>

                {open && (
                  <tr>
                    <td colSpan={7} className="bg-ink-900/60 px-4 py-4">
                      <div className="mb-3 grid gap-3 text-xs sm:grid-cols-4">
                        <Detail label="Total invested" value={money(p.totalCost)} />
                        <Detail label="Taken out (sales)" value={money(p.proceeds)} />
                        <Detail label="Average buy price" value={money(p.averageBuyPrice)} />
                        <Detail label="Break-even price" value={money(p.breakEvenPrice)} />
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-slate-500">
                            <th className="py-1 font-medium">Date</th>
                            <th className="py-1 font-medium">Type</th>
                            <th className="py-1 text-right font-medium">Quantity</th>
                            <th className="py-1 text-right font-medium">Amount</th>
                            <th className="py-1 text-right font-medium">Unit price</th>
                          </tr>
                        </thead>
                        <tbody className="tnum">
                          {p.transactions.map((tx, i) => {
                            const gbpCost = costInGbp(tx);
                            const outgoing = tx.type === 'sell' || tx.type === 'transfer_out';
                            return (
                              <tr key={`${tx.date}-${i}`} className="border-t border-ink-600/60">
                                <td className="py-1.5 text-slate-400">{shortDate(tx.date)}</td>
                                <td className="py-1.5 capitalize text-slate-300">
                                  {tx.type.replace('_', ' ')}
                                </td>
                                <td
                                  className={`py-1.5 text-right ${outgoing ? 'text-loss' : 'text-gain'}`}
                                >
                                  {outgoing ? '\u2212' : '+'}
                                  {fmtQty(tx.qty)}
                                </td>
                                <td className="py-1.5 text-right text-slate-300">
                                  {gbpCost ? money(gbpCost) : '\u2014'}
                                  {tx.currency !== 'GBP' && (
                                    <span className="ml-1 text-slate-500">
                                      ({originalAmount(tx.cost, tx.currency)})
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 text-right text-slate-400">
                                  {gbpCost ? money(gbpCost / tx.qty) : '\u2014'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {p.transactions.some((tx) => tx.note) && (
                        <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                          {p.transactions
                            .filter((tx) => tx.note)
                            .map((tx, i) => (
                              <li key={i}>
                                {shortDate(tx.date)} &mdash; {tx.note}
                              </li>
                            ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </section>

      <AlertsPanel
        alerts={alerts}
        positions={summary.positions}
        onChange={updateAlerts}
        notificationState={notificationState}
        onEnableNotifications={enableNotifications}
      />

      {source === 'coingecko' && staleSymbols.length > 0 && (
        <p className="mt-4 text-xs text-amber-500/80">
          * {staleSymbols.slice(0, 6).join(', ')}
          {staleSymbols.length > 6 && ` and ${staleSymbols.length - 6} more`}{' '}
          {staleSymbols.length === 1 ? 'has' : 'have'} no live price — CoinGecko no longer lists
          {staleSymbols.length === 1 ? ' it' : ' them'}, so the price from your imported snapshot is
          used instead.
        </p>
      )}

      <footer className="mt-6 text-xs text-slate-600">
        Transactions imported {data.lastImportedAt} from {data.sources[0]}. Edit
        <code className="mx-1 rounded bg-ink-700 px-1 py-0.5 text-slate-400">data/transactions.json</code>
        to add more.
      </footer>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  big,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: string;
  big?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-ink-500 bg-ink-800 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 ${big ? 'text-2xl' : 'text-xl'} font-semibold tnum ${tone}`}>{value}</p>
      {sub && <p className={`mt-0.5 text-sm tnum ${tone} opacity-80`}>{sub}</p>}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2">
      <p className="text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-200 tnum">{value}</p>
    </div>
  );
}
