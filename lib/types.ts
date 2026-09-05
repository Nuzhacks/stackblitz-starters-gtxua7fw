export type TxType = 'buy' | 'sell' | 'transfer_in' | 'transfer_out';

export interface Transaction {
  date: string;
  type: TxType;
  qty: number;
  cost: number;
  currency: 'GBP' | 'USD' | 'EUR';
  /** Rate back to GBP for this transaction, when currency is not GBP. */
  fxToGbp?: number;
  /** Pre-converted GBP amount, used in preference to cost/fxToGbp when present. */
  costGbp?: number;
  note?: string;
}

export interface AssetData {
  symbol: string;
  name: string;
  coingeckoId: string;
  colour: string;
  transactions: Transaction[];
}

export interface PortfolioData {
  baseCurrency: string;
  lastImportedAt: string;
  sources: string[];
  assets: AssetData[];
}

export interface PricePoint {
  gbp: number;
  change24h: number | null;
  updatedAt: string;
  stale?: boolean;
}

export type PriceMap = Record<string, PricePoint>;

export interface AssetPosition {
  symbol: string;
  name: string;
  coingeckoId: string;
  colour: string;
  qty: number;
  /** Sum of buy costs in GBP. Matches CoinGecko's "Total cost". */
  totalCost: number;
  /** Sum of sell proceeds in GBP. */
  proceeds: number;
  /** (totalCost - proceeds) / qty. Matches CoinGecko's "Average net cost". */
  averageNetCost: number;
  /** totalCost / qty acquired, ignoring sales. */
  averageBuyPrice: number;
  price: number | null;
  change24h: number | null;
  value: number | null;
  /** value - (totalCost - proceeds). Matches CoinGecko's "Total profit/loss". */
  profitLoss: number | null;
  /** profitLoss / totalCost, as a percentage. */
  profitLossPct: number | null;
  /** Share of total portfolio value, as a percentage. */
  allocationPct: number | null;
  /** Price at which the position breaks even against net cost. */
  breakEvenPrice: number;
  transactions: Transaction[];
  priceStale: boolean;
  updatedAt: string | null;
}

export interface PortfolioSummary {
  positions: AssetPosition[];
  totalValue: number;
  totalCost: number;
  totalProceeds: number;
  totalNetCost: number;
  totalProfitLoss: number;
  totalProfitLossPct: number;
  change24hValue: number;
  change24hPct: number;
  pricedCount: number;
  updatedAt: string | null;
}
