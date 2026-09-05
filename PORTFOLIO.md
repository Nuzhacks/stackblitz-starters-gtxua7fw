# Portfolio record

Transcribed from CoinGecko app screenshots on 5 September 2026 (captured 22:09–22:10).
The machine-readable source of truth is [`data/transactions.json`](data/transactions.json);
this file is the human-readable copy.

All values in GBP. Transactions priced in USD show the original dollar amount and the
rate used to convert. **The screenshots showed dates only, no times of day.**

## Holdings

| Asset | Quantity | Invested | Taken out | Avg net cost | Transactions |
|---|---:|---:|---:|---:|---:|
| BTC Bitcoin | 0.30871163 | £9,288.44 | £1,065.71 | £26,635.63 | 6 |
| ETH Ethereum | 6.41900752 | £5,034.47 | £0 | £784.31 | 7 |
| LINK Chainlink | 375.50268982 | £3,682.72 | £7.42 | £9.79 | 11 |
| SOL Solana | 35.01108 | £1,363.13 | £0 | £38.93 | 9 |
| **Total** | | **£19,368.76** | **£1,073.13** | | **33** |

At the prices showing in the screenshots (BTC £59,000, ETH £1,833, LINK £8.89, SOL £76.65)
that is roughly **£36,000 in value against £18,296 net invested — about +£17,700, +91%**.

## BTC — Bitcoin

| Date | Type | Quantity | Amount | Unit price |
|---|---|---:|---:|---:|
| 20 Dec 2023 | Buy | +0.02892 | £1,000.61 | £34,599 |
| 9 Dec 2023 | Buy | +0.09682669 | £1,336.01 | £13,798 |
| 31 Jul 2021 | Sell | −0.03582 | £1,065.71 | £29,752 |
| 27 Jul 2021 | Buy | +0.03564125 | £999.98 | £28,057 |
| 16 May 2021 | Buy | +0.0311135 | £1,005.28 | £32,310 |
| 23 Feb 2021 | Buy | +0.15203019 | £4,946.56 ($7,044.77) | £32,537 |

## ETH — Ethereum

| Date | Type | Quantity | Amount | Unit price |
|---|---|---:|---:|---:|
| 11 Nov 2024 | Transfer out | −0.09 | — | — |
| 14 Jun 2022 | Buy | +1.50337882 | £1,498.69 | £997 |
| 9 Dec 2021 | Buy | +1.31 | £0 | — |
| 1 Apr 2021 | Buy | +0.35 | £385.00 | £1,100 |
| 23 Feb 2021 | Buy | +0.94609685 | £704.80 ($986.48) | £745 |
| 23 Feb 2021 | Buy | +1.38769803 | £1,489.50 ($2,084.82) | £1,073 |
| 8 Jan 2021 | Buy | +1.01183382 | £956.50 ($1,338.78) | £945 |

The 9 Dec 2021 buy of 1.31 ETH is recorded with a £0 cost in CoinGecko, so it flatters
the average cost. Worth correcting if the real purchase price is known.

## LINK — Chainlink

| Date | Type | Quantity | Amount | Unit price |
|---|---|---:|---:|---:|
| 24 Mar 2026 | Buy | +107.23 | £750.00 | £6.99 |
| 18 Mar 2026 | Buy | +65.83 | £500.04 | £7.60 |
| 7 Mar 2026 | Buy | +55.99 | £379.96 | £6.79 |
| 25 Feb 2025 | Buy | +52.42 | £599.45 | £11.44 |
| 11 Feb 2025 | Buy | +58.59880982 | £907.27 | £15.48 |
| 2 Feb 2025 | Buy | +3.88588 | £69.02 | £17.76 |
| 15 Feb 2022 | Sell | −0.322 | £3.78 | £11.74 |
| 15 Feb 2022 | Buy | +13.15 | £155.15 | £11.80 |
| 23 May 2021 | Buy | +6.6 | £87.59 | £13.27 |
| 3 May 2021 | Sell | −0.12 | £3.64 | £30.31 |
| 2 Feb 2021 | Buy | +12.24 | £234.25 ($318.24) | £19.14 |

The only position underwater at import: −£338 (−9.2%).

## SOL — Solana

| Date | Type | Quantity | Amount | Unit price |
|---|---|---:|---:|---:|
| 27 Mar 2026 | Buy | +4.62 | £299.60 | £64.85 |
| 24 Feb 2026 | Buy | +8.76778 | £502.00 | £57.26 |
| 13 Aug 2025 | Transfer in | +1.0926 | — | — |
| 22 Nov 2024 | Transfer in | +0.0217 | — | — |
| 17 Nov 2024 | Transfer in | +0.09 | — | — |
| 9 Nov 2024 | Transfer in | +1.28 | — | — |
| 8 Dec 2023 | Buy | +2.32 | £0 | — |
| 28 Jan 2023 | Buy | +2.54 | £49.61 | £19.53 |
| 4 May 2021 | Buy | +14.279 | £511.92 | £35.85 |

No portfolio summary card was captured for SOL, so its holdings and cost are computed
from the transaction list rather than read off the screen. The four transfers in and the
£0 buy carry no cost, which understates the true cost basis.

## How the numbers are calculated

The dashboard follows CoinGecko's own conventions so figures reconcile with the app the
data came from:

- **Total cost** = sum of buy costs (sales do not reduce it)
- **Average net cost** = (total cost − sale proceeds) ÷ holdings
- **Profit / loss** = value − (total cost − sale proceeds)
- **Profit / loss %** = profit / loss ÷ total cost
- Transfers move quantity without touching cost or proceeds

Verified: computed holdings, total cost, average net cost, profit and profit % match the
CoinGecko figures for BTC, ETH and LINK to the penny (see `data/coingecko-snapshot.json`).

## Known gaps

1. **No SOL summary card** — its figures are derived, not verified against CoinGecko.
2. **No times of day** — only dates were visible in the screenshots.
3. **Zero-cost entries** — ETH 1.31 (9 Dec 2021) and SOL 2.32 (8 Dec 2023) show £0.
4. **USD conversions** — five transactions were priced in dollars. The rate on each was
   picked so the per-asset totals reconcile exactly with CoinGecko's own totals
   (1.4242, 1.3997 and 1.3586, all close to the real rates on those dates).
5. **Possible missing assets** — only BTC, ETH, LINK and SOL were captured.
