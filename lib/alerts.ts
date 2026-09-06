import type { AssetPosition } from './types';
import { priceForProfitPct } from './portfolio';

export type AlertKind =
  | 'price_above'
  | 'price_below'
  | 'profit_pct_above'
  | 'profit_pct_below'
  | 'value_above'
  | 'trailing_stop'
  /** Whole-portfolio level, not tied to one coin. Used by the exit planner. */
  | 'portfolio_above';

/** Symbol used by alerts that watch the portfolio as a whole. */
export const PORTFOLIO_SCOPE = 'PORTFOLIO';

export interface Alert {
  id: string;
  symbol: string;
  kind: AlertKind;
  /** Target price, percentage, or value depending on kind. */
  threshold: number;
  note?: string;
  enabled: boolean;
  createdAt: string;
  /** Highest price seen since the alert was armed. Trailing stops only. */
  peakPrice?: number;
  triggeredAt?: string;
  /** Set when the user dismisses a fired alert without deleting it. */
  acknowledged?: boolean;
}

export interface AlertEvaluation {
  alert: Alert;
  firing: boolean;
  /** 0-1, how close the alert is to firing. */
  progress: number;
  current: number | null;
  targetLabel: string;
  currentLabel: string;
  message: string;
}

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  price_above: 'Price rises above',
  price_below: 'Price falls below',
  profit_pct_above: 'Total profit rises above',
  profit_pct_below: 'Total profit falls below',
  value_above: 'Holding value rises above',
  trailing_stop: 'Trailing stop from peak',
  portfolio_above: 'Whole portfolio rises above',
};

/** Kinds a person picks per coin; portfolio_above is created by the exit planner instead. */
export const PER_ASSET_KINDS: AlertKind[] = [
  'price_above',
  'price_below',
  'profit_pct_above',
  'profit_pct_below',
  'value_above',
  'trailing_stop',
];

export const STORAGE_KEY = 'crypto-dashboard.alerts.v1';

export function loadAlerts(): Alert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Alert[]) : [];
  } catch {
    return [];
  }
}

export function saveAlerts(alerts: Alert[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    /* storage unavailable (private window, blocked cookies) - alerts stay in memory */
  }
}

export function newAlertId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Clamp a raw ratio into a 0-1 progress bar value. */
function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function evaluateAlert(
  alert: Alert,
  position: AssetPosition | undefined,
  portfolioValue?: number,
): AlertEvaluation {
  if (alert.kind === 'portfolio_above') {
    const current = portfolioValue ?? 0;
    return {
      alert,
      firing: current >= alert.threshold,
      progress: clamp(current / alert.threshold),
      current,
      targetLabel: `£${alert.threshold.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`,
      currentLabel: `£${current.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`,
      message: `Portfolio reached £${alert.threshold.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`,
    };
  }

  const price = position?.price ?? null;
  const base: Omit<AlertEvaluation, 'firing' | 'progress' | 'current' | 'targetLabel' | 'currentLabel' | 'message'> = { alert };

  if (!position || price === null) {
    return {
      ...base,
      firing: false,
      progress: 0,
      current: null,
      targetLabel: String(alert.threshold),
      currentLabel: '—',
      message: 'Waiting for a price',
    };
  }

  switch (alert.kind) {
    case 'price_above':
      return {
        ...base,
        firing: price >= alert.threshold,
        progress: clamp(price / alert.threshold),
        current: price,
        targetLabel: `£${alert.threshold.toLocaleString('en-GB')}`,
        currentLabel: `£${price.toLocaleString('en-GB', { maximumFractionDigits: 4 })}`,
        message: `${alert.symbol} at or above £${alert.threshold.toLocaleString('en-GB')}`,
      };

    case 'price_below':
      return {
        ...base,
        firing: price <= alert.threshold,
        progress: clamp(alert.threshold / price),
        current: price,
        targetLabel: `£${alert.threshold.toLocaleString('en-GB')}`,
        currentLabel: `£${price.toLocaleString('en-GB', { maximumFractionDigits: 4 })}`,
        message: `${alert.symbol} at or below £${alert.threshold.toLocaleString('en-GB')}`,
      };

    case 'profit_pct_above': {
      const current = position.profitLossPct ?? 0;
      return {
        ...base,
        firing: current >= alert.threshold,
        progress: clamp(current / alert.threshold),
        current,
        targetLabel: `${alert.threshold}%`,
        currentLabel: `${current.toFixed(1)}%`,
        message: `${alert.symbol} profit reached ${alert.threshold}% (needs £${priceForProfitPct(position, alert.threshold).toLocaleString('en-GB', { maximumFractionDigits: 2 })})`,
      };
    }

    case 'profit_pct_below': {
      const current = position.profitLossPct ?? 0;
      return {
        ...base,
        firing: current <= alert.threshold,
        progress: clamp(alert.threshold / current),
        current,
        targetLabel: `${alert.threshold}%`,
        currentLabel: `${current.toFixed(1)}%`,
        message: `${alert.symbol} profit dropped to ${alert.threshold}%`,
      };
    }

    case 'value_above': {
      const current = position.value ?? 0;
      return {
        ...base,
        firing: current >= alert.threshold,
        progress: clamp(current / alert.threshold),
        current,
        targetLabel: `£${alert.threshold.toLocaleString('en-GB')}`,
        currentLabel: `£${current.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`,
        message: `${alert.symbol} holding worth £${alert.threshold.toLocaleString('en-GB')} or more`,
      };
    }

    case 'trailing_stop': {
      const peak = Math.max(alert.peakPrice ?? price, price);
      const stopPrice = peak * (1 - alert.threshold / 100);
      const dropPct = ((peak - price) / peak) * 100;
      return {
        ...base,
        firing: price <= stopPrice,
        progress: clamp(dropPct / alert.threshold),
        current: price,
        targetLabel: `£${stopPrice.toLocaleString('en-GB', { maximumFractionDigits: 2 })} (−${alert.threshold}% from £${peak.toLocaleString('en-GB', { maximumFractionDigits: 2 })})`,
        currentLabel: `£${price.toLocaleString('en-GB', { maximumFractionDigits: 4 })}`,
        message: `${alert.symbol} fell ${alert.threshold}% from its peak of £${peak.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`,
      };
    }
  }
}

/** Update trailing-stop peaks as prices move. Returns a new array if anything changed. */
export function trackPeaks(alerts: Alert[], positions: AssetPosition[]): Alert[] {
  let changed = false;
  const next = alerts.map((alert) => {
    if (alert.kind !== 'trailing_stop') return alert;
    const price = positions.find((p) => p.symbol === alert.symbol)?.price;
    if (price === null || price === undefined) return alert;
    if (alert.peakPrice !== undefined && price <= alert.peakPrice) return alert;
    changed = true;
    return { ...alert, peakPrice: price };
  });
  return changed ? next : alerts;
}

/** Suggest a starting set of exit rules for a position: take profit ladder plus a trailing stop. */
export function suggestExitLadder(position: AssetPosition): Alert[] {
  const now = new Date().toISOString();
  const current = position.profitLossPct ?? 0;
  const rungs = [25, 50, 100, 200].filter((r) => r > current + 5).slice(0, 3);

  const alerts: Alert[] = rungs.map((rung) => ({
    id: newAlertId(),
    symbol: position.symbol,
    kind: 'profit_pct_above',
    threshold: rung,
    note: `Take profit at +${rung}% (price ≈ £${priceForProfitPct(position, rung).toLocaleString('en-GB', { maximumFractionDigits: 2 })})`,
    enabled: true,
    createdAt: now,
  }));

  if (position.price !== null) {
    alerts.push({
      id: newAlertId(),
      symbol: position.symbol,
      kind: 'trailing_stop',
      threshold: 20,
      note: 'Protect gains: exit if it drops 20% from its peak',
      enabled: true,
      createdAt: now,
      peakPrice: position.price,
    });
    alerts.push({
      id: newAlertId(),
      symbol: position.symbol,
      kind: 'price_below',
      threshold: Number(position.breakEvenPrice.toPrecision(4)),
      note: 'Break-even warning: position slips into a loss below this',
      enabled: true,
      createdAt: now,
    });
  }

  return alerts;
}
