# Crypto portfolio dashboard

A personal dashboard for monitoring crypto holdings and setting exit alerts. Live prices
come from CoinGecko; the transaction history is kept in a file you own.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

No API key is needed. CoinGecko's free endpoint allows a modest number of calls per
minute and the dashboard refreshes once a minute, which sits well inside that. If you hit
rate limits, put a free demo key in `.env.local`:

```
COINGECKO_API_KEY=CG-your-key-here
```

If the price lookup fails for any reason the dashboard falls back to the prices captured
at import time and says so at the top, rather than showing blanks.

## What it shows

- Portfolio value, total profit/loss, 24 hour move and net invested
- A row per asset with price, 24h change, average net cost, value and profit/loss
- Click any asset to expand its full transaction history, average buy price and
  break-even price

## History chart

The dashboard opens with portfolio value since 2021, plotted against what you had put
in by each point. Value is computed from each coin's daily GBP price applied to the
holdings you actually owned that week, so the line moves both when prices move and when
you buy. Hover for any week's figures, switch between 1Y / 3Y / All, or open the table
view for the same data as numbers.

The series lives in [`data/history.json`](data/history.json). Refresh it after adding
transactions:

```bash
npm run fetch-history
```

That takes a minute or so — one request per coin, paced to stay inside CoinGecko's free
rate limit. Transactions with no recorded date cannot be placed on a timeline, so they
are left out; the file records how much cost that excludes.

## What the numbers say

Below the chart is an analysis panel that recalculates from live prices on every refresh:

- **Return per year** — the money-weighted return, which counts *when* each pound went in.
  This is usually well below the headline profit percentage, because that figure ignores
  timing and treats a pound invested last month the same as one invested in 2021.
- **Purchases in profit** — how many individual buys are up, and what the winners and
  losers each turned into.
- **Worst fall so far** — the deepest peak-to-trough drop in the history, and the share of
  weeks the portfolio was worth less than had been put in.
- **Concentration** — the two largest holdings against everything else, as a share of money
  invested and a share of value now.
- **Every pound by the year you spent it**, and the best and worst single buys.

Per-purchase figures value each buy as if it is still held, so sale proceeds are not
deducted from them; the panel says so and the totals elsewhere handle sales properly.

## Exit alerts

The alerts panel lets you set rules that are checked every time prices refresh:

| Rule | Use it for |
|---|---|
| Price rises above / falls below | A specific price you want to act at |
| Total profit rises above | Taking profit at a percentage return |
| Total profit falls below | A stop measured against what you put in |
| Holding value rises above | A cash target for a position |
| Trailing stop from peak | Protecting gains once a run is over |

**Suggest exit plan** generates a starting set for the selected asset: take-profit rungs
above the current return, a 20% trailing stop, and a break-even warning.

Alerts are stored in the browser's local storage, so they stay on the device you set them
on and are not synced anywhere. Turn on desktop notifications to be told when one fires
while the tab is open in the background.

Alerts fire while the page is open. They are a prompt to look, not an automated trade.

## Adding transactions

Everything is derived from [`data/transactions.json`](data/transactions.json). Add an
entry to the right asset and the dashboard recalculates:

```json
{ "date": "2026-09-05", "type": "buy", "qty": 0.5, "cost": 250.00, "currency": "GBP" }
```

- `type` is `buy`, `sell`, `transfer_in` or `transfer_out`
- `cost` is the total amount, not the unit price
- For a USD or EUR amount, add `"currency": "USD"` (or `"EUR"`) and either
  `"fxToGbp": 1.27` or a pre-converted `"costGbp": 196.85`
- Transfers move quantity without affecting cost basis

To track a new coin, add an asset block with its CoinGecko id (the last part of its
coingecko.com URL, e.g. `cardano`). Forty-eight are tracked today.

[`PORTFOLIO.md`](PORTFOLIO.md) is the human-readable copy of the same history, including
what is missing or uncertain in it.

## How figures are calculated

The maths follows CoinGecko's conventions so the numbers reconcile with the app the data
was imported from — total cost counts buys only, average net cost nets off sale proceeds,
and profit/loss percentage is measured against total cost. See the bottom of
`PORTFOLIO.md` for the exact formulas.
