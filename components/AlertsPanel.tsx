'use client';

import { useMemo, useState } from 'react';
import type { AssetPosition } from '@/lib/types';
import {
  ALERT_KIND_LABELS,
  PER_ASSET_KINDS,
  evaluateAlert,
  newAlertId,
  suggestExitLadder,
  type Alert,
  type AlertKind,
} from '@/lib/alerts';
import { priceForProfitPct } from '@/lib/portfolio';

interface Props {
  alerts: Alert[];
  positions: AssetPosition[];
  onChange: (alerts: Alert[]) => void;
  portfolioValue: number;
  notificationState: NotificationPermission | 'unsupported';
  onEnableNotifications: () => void;
}

const KIND_UNITS: Record<AlertKind, string> = {
  price_above: '£',
  price_below: '£',
  profit_pct_above: '%',
  profit_pct_below: '%',
  value_above: '£',
  trailing_stop: '%',
  portfolio_above: '£',
};

export default function AlertsPanel({
  alerts,
  positions,
  onChange,
  portfolioValue,
  notificationState,
  onEnableNotifications,
}: Props) {
  const [symbol, setSymbol] = useState(positions[0]?.symbol ?? 'BTC');
  const [kind, setKind] = useState<AlertKind>('profit_pct_above');
  const [threshold, setThreshold] = useState('');
  const [note, setNote] = useState('');

  const byId = useMemo(
    () => new Map(positions.map((p) => [p.symbol, p])),
    [positions],
  );

  const evaluations = useMemo(
    () =>
      alerts
        .map((alert) => evaluateAlert(alert, byId.get(alert.symbol), portfolioValue))
        .sort((a, b) => {
          if (a.firing !== b.firing) return a.firing ? -1 : 1;
          return b.progress - a.progress;
        }),
    [alerts, byId, portfolioValue],
  );

  function addAlert() {
    const value = Number(threshold);
    if (!Number.isFinite(value) || value === 0) return;
    const position = byId.get(symbol);
    const alert: Alert = {
      id: newAlertId(),
      symbol,
      kind,
      threshold: value,
      note: note.trim() || undefined,
      enabled: true,
      createdAt: new Date().toISOString(),
      ...(kind === 'trailing_stop' && position?.price ? { peakPrice: position.price } : {}),
    };
    onChange([...alerts, alert]);
    setThreshold('');
    setNote('');
  }

  function update(id: string, patch: Partial<Alert>) {
    onChange(alerts.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function remove(id: string) {
    onChange(alerts.filter((a) => a.id !== id));
  }

  function addLadder() {
    const position = byId.get(symbol);
    if (!position) return;
    const existing = new Set(alerts.map((a) => `${a.symbol}|${a.kind}|${a.threshold}`));
    const additions = suggestExitLadder(position).filter(
      (a) => !existing.has(`${a.symbol}|${a.kind}|${a.threshold}`),
    );
    if (additions.length) onChange([...alerts, ...additions]);
  }

  const previewPosition = byId.get(symbol);
  const preview =
    previewPosition && threshold && kind === 'profit_pct_above'
      ? `≈ £${priceForProfitPct(previewPosition, Number(threshold)).toLocaleString('en-GB', { maximumFractionDigits: 2 })} per ${symbol}`
      : null;

  return (
    <section className="rounded-2xl border border-ink-500 bg-ink-800 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Exit alerts</h2>
          <p className="text-sm text-slate-400">
            Rules are checked every time prices refresh. They live in this browser only.
          </p>
        </div>
        {notificationState === 'granted' ? (
          <span className="rounded-full bg-ink-600 px-3 py-1 text-xs text-slate-300">
            Desktop notifications on
          </span>
        ) : notificationState === 'unsupported' ? (
          <span className="rounded-full bg-ink-600 px-3 py-1 text-xs text-slate-400">
            Notifications unavailable
          </span>
        ) : (
          <button
            onClick={onEnableNotifications}
            className="rounded-full border border-ink-500 px-3 py-1 text-xs text-slate-200 hover:bg-ink-600"
          >
            Enable desktop notifications
          </button>
        )}
      </div>

      <div className="mb-5 grid gap-2 rounded-xl border border-ink-500 bg-ink-700 p-3 sm:grid-cols-[auto_1fr_auto_auto]">
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="rounded-lg border border-ink-500 bg-ink-800 px-3 py-2 text-sm"
          aria-label="Asset"
        >
          {positions.map((p) => (
            <option key={p.symbol} value={p.symbol}>
              {p.symbol}
            </option>
          ))}
        </select>

        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as AlertKind)}
          className="rounded-lg border border-ink-500 bg-ink-800 px-3 py-2 text-sm"
          aria-label="Condition"
        >
          {PER_ASSET_KINDS.map((k) => (
            <option key={k} value={k}>
              {ALERT_KIND_LABELS[k]}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 rounded-lg border border-ink-500 bg-ink-800 px-3">
          <span className="text-sm text-slate-400">{KIND_UNITS[kind] === '£' ? '£' : ''}</span>
          <input
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAlert()}
            inputMode="decimal"
            placeholder="0"
            aria-label="Threshold"
            className="w-24 bg-transparent py-2 text-sm outline-none tnum"
          />
          <span className="text-sm text-slate-400">{KIND_UNITS[kind] === '%' ? '%' : ''}</span>
        </div>

        <button
          onClick={addAlert}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
        >
          Add alert
        </button>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addAlert()}
          placeholder="Why this level? (optional note to yourself)"
          className="rounded-lg border border-ink-500 bg-ink-800 px-3 py-2 text-sm outline-none sm:col-span-3"
        />
        <button
          onClick={addLadder}
          className="rounded-lg border border-ink-500 px-3 py-2 text-xs text-slate-300 hover:bg-ink-600"
          title="Adds take-profit rungs, a 20% trailing stop and a break-even warning"
        >
          Suggest {symbol} exit plan
        </button>
        {preview && (
          <p className="text-xs text-slate-400 sm:col-span-4">
            +{threshold}% total profit on {symbol} {preview}
          </p>
        )}
      </div>

      {evaluations.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          No alerts yet. Add a level above, or use the suggested exit plan as a starting point.
        </p>
      ) : (
        <ul className="space-y-2">
          {evaluations.map(({ alert, firing, progress, targetLabel, currentLabel }) => (
            <li
              key={alert.id}
              className={`rounded-xl border p-3 ${
                firing && alert.enabled
                  ? 'border-emerald-500/60 bg-emerald-500/10'
                  : 'border-ink-500 bg-ink-700'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{alert.symbol}</span>{' '}
                    <span className="text-slate-300">
                      {ALERT_KIND_LABELS[alert.kind].toLowerCase()}
                    </span>{' '}
                    <span className="font-semibold tnum">{targetLabel}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 tnum">
                    now {currentLabel}
                    {firing && alert.enabled && (
                      <span className="ml-2 font-semibold text-emerald-400">TRIGGERED</span>
                    )}
                  </p>
                  {alert.note && <p className="mt-1 text-xs text-slate-500">{alert.note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => update(alert.id, { enabled: !alert.enabled })}
                    className="rounded-lg border border-ink-500 px-2 py-1 text-xs text-slate-300 hover:bg-ink-600"
                  >
                    {alert.enabled ? 'Mute' : 'Unmute'}
                  </button>
                  <button
                    onClick={() => remove(alert.id)}
                    className="rounded-lg border border-ink-500 px-2 py-1 text-xs text-slate-400 hover:bg-ink-600 hover:text-loss"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-600">
                <div
                  className={`h-full rounded-full ${firing ? 'bg-emerald-400' : 'bg-slate-500'}`}
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
