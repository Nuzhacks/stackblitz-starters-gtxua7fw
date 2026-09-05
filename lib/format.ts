const gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const gbp2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const gbp4 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 4 });
// Sub-penny prices need significant digits, not fixed decimals, or they all render as £0.0000.
const gbpTiny = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumSignificantDigits: 4 });

export function money(value: number | null, opts: { round?: boolean } = {}): string {
  if (value === null || Number.isNaN(value)) return '—';
  if (opts.round) return gbp0.format(value);
  const size = Math.abs(value);
  if (size >= 10) return gbp2.format(value);
  if (size >= 0.01 || size === 0) return gbp4.format(value);
  return gbpTiny.format(value);
}

export function signedMoney(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : '−'}${money(Math.abs(value))}`;
}

export function pct(value: number | null, dp = 1): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(dp)}%`;
}

export function qty(value: number, symbol?: string): string {
  const formatted = value.toLocaleString('en-GB', { maximumFractionDigits: 8 });
  return symbol ? `${formatted} ${symbol}` : formatted;
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '\u20ac', GBP: '\u00a3' };

/** The amount as originally recorded, for transactions not priced in GBP. */
export function originalAmount(cost: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${cost.toLocaleString('en-GB', { maximumFractionDigits: 4 })}`;
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
