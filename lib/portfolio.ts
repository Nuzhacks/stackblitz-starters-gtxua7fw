import type {
  AssetData,
  AssetPosition,
  PortfolioData,
  PortfolioSummary,
  PriceMap,
  Transaction,
} from './types';

/** GBP value of a transaction, converting USD amounts where needed. */
export function costInGbp(tx: Transaction): number {
  if (typeof tx.costGbp === 'number') return tx.costGbp;
  if (tx.currency !== 'GBP' && tx.fxToGbp) return tx.cost / tx.fxToGbp;
  return tx.cost;
}

/** Signed quantity: buys and transfers in add, sells and transfers out subtract. */
export function signedQty(tx: Transaction): number {
  return tx.type === 'sell' || tx.type === 'transfer_out' ? -tx.qty : tx.qty;
}

/**
 * Cost basis follows CoinGecko's convention so the numbers reconcile with the
 * app the data came from:
 *   total cost        = sum of buy costs
 *   average net cost  = (total cost - sell proceeds) / holdings
 *   profit/loss       = value - (total cost - sell proceeds)
 *   profit/loss %     = profit/loss / total cost
 * Transfers move quantity without touching cost or proceeds.
 */
export function buildPosition(asset: AssetData, prices: PriceMap): AssetPosition {
  let qty = 0;
  let totalCost = 0;
  let proceeds = 0;
  let qtyAcquired = 0;

  for (const tx of asset.transactions) {
    qty += signedQty(tx);
    if (tx.type === 'buy') {
      totalCost += costInGbp(tx);
      qtyAcquired += tx.qty;
    } else if (tx.type === 'sell') {
      proceeds += costInGbp(tx);
    }
  }

  const netCost = totalCost - proceeds;
  const price = prices[asset.symbol]?.gbp ?? null;
  const value = price === null ? null : qty * price;
  const profitLoss = value === null ? null : value - netCost;

  return {
    symbol: asset.symbol,
    name: asset.name,
    coingeckoId: asset.coingeckoId,
    colour: asset.colour,
    qty,
    totalCost,
    proceeds,
    averageNetCost: qty > 0 ? netCost / qty : 0,
    averageBuyPrice: qtyAcquired > 0 ? totalCost / qtyAcquired : 0,
    price,
    change24h: prices[asset.symbol]?.change24h ?? null,
    value,
    profitLoss,
    profitLossPct:
      profitLoss === null || totalCost === 0 ? null : (profitLoss / totalCost) * 100,
    allocationPct: null,
    breakEvenPrice: qty > 0 ? netCost / qty : 0,
    transactions: [...asset.transactions].sort((a, b) => b.date.localeCompare(a.date)),
    priceStale: prices[asset.symbol]?.stale ?? false,
    updatedAt: prices[asset.symbol]?.updatedAt ?? null,
  };
}

export function buildSummary(data: PortfolioData, prices: PriceMap): PortfolioSummary {
  const positions = data.assets.map((asset) => buildPosition(asset, prices));

  const totalValue = positions.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const totalCost = positions.reduce((sum, p) => sum + p.totalCost, 0);
  const totalProceeds = positions.reduce((sum, p) => sum + p.proceeds, 0);
  const totalNetCost = totalCost - totalProceeds;
  const totalProfitLoss = totalValue - totalNetCost;

  for (const p of positions) {
    p.allocationPct = p.value === null || totalValue === 0 ? null : (p.value / totalValue) * 100;
  }

  // 24h move in money terms, using each asset's own percentage change.
  let change24hValue = 0;
  let valueWithChange = 0;
  for (const p of positions) {
    if (p.value === null || p.change24h === null) continue;
    const previous = p.value / (1 + p.change24h / 100);
    change24hValue += p.value - previous;
    valueWithChange += previous;
  }

  positions.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  const updatedAt = positions.map((p) => p.updatedAt).find(Boolean) ?? null;

  return {
    positions,
    totalValue,
    totalCost,
    totalProceeds,
    totalNetCost,
    totalProfitLoss,
    totalProfitLossPct: totalCost === 0 ? 0 : (totalProfitLoss / totalCost) * 100,
    change24hValue,
    change24hPct: valueWithChange === 0 ? 0 : (change24hValue / valueWithChange) * 100,
    pricedCount: positions.filter((p) => p.price !== null).length,
    updatedAt,
  };
}

/** Portfolio value if one asset moved to a hypothetical price. Used by the alert builder. */
export function valueAtPrice(position: AssetPosition, price: number): number {
  return position.qty * price;
}

/** Price required for a position to hit a given profit/loss percentage. */
export function priceForProfitPct(position: AssetPosition, pct: number): number {
  const netCost = position.totalCost - position.proceeds;
  const targetValue = netCost + (position.totalCost * pct) / 100;
  return position.qty > 0 ? targetValue / position.qty : 0;
}
