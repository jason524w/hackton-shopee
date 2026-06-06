# Mock Signals Guide

This demo is fully backed by mock data. It does not scrape Shopee, call Shopee
Ads, call Seller Centre, or query 1688 in real time.

## Current Mock Scope

- Product directions: five user-provided directions are stored in
  `contract/mock-result.json` under `product_directions`.
- Market signals: `market_trend_agent_output` represents Shopee SG mock signals.
- Sourcing signals: `sourcing_agent_output` represents 1688 mock signals.
- UI source: the homepage imports `contract/mock-result.json` directly.
- API source: `GET /api/run?mock=1` and `POST /api/run?mock=1` return the same
  `contract/mock-result.json`.

## Product Directions

| id | English | Chinese | 1688 search keyword |
| --- | --- | --- | --- |
| `mini-desk-vacuum` | Mini desk vacuum | 桌面吸尘器 | Mini desk vacuum |
| `portable-dehumidifier` | Portable dehumidifier | 小型除湿器 | Portable dehumidifier |
| `cable-organizer` | Cable organizer | 桌面线缆收纳 | Cable organizer |
| `pet-grooming-tool` | Pet grooming tool | 宠物清洁小工具 | Pet grooming tool |
| `compact-garment-steamer` | Compact garment steamer | 手持挂烫机 | Compact garment steamer |

## Market Trend Agent Output

The Market Trend Agent mock is used to judge whether a product direction has
buyer demand, competition, and heat on Shopee SG.

Required fields:

- `demand_signal_score`
- `competitor_count`
- `price_band`
- `review_density`
- `rating_distribution`
- `trend_source_links`

Mock sources represented:

- Shopee SG search results
- Shopee Ads or Seller Centre signals
- Shopee category pages
- Web trend links
- User-provided product keywords

## Sourcing Agent Output

The Sourcing Agent mock is used to judge whether the item can be bought cheaply,
whether stock is enough, and whether fulfillment can work.

Required fields:

- `source_price`
- `supplier_candidates`
- `available_stock`
- `min_order_quantity`
- `estimated_domestic_shipping_time`
- `package_weight`
- `package_dimensions`

Mock sources represented:

- 1688 search results
- Supplier quote ranges
- Supplier stock
- MOQ
- Domestic shipping time to a forwarder warehouse
- Package weight and dimensions

## Replacement Path For Real Data

When live providers are ready, keep the contract shape stable and replace only
the data source:

1. Keep `contract/result.ts` as the TypeScript source of truth.
2. Keep `contract/result.schema.json` aligned with `result.ts`.
3. Keep `contract/mock-result.json` as the demo fallback.
4. Wire live Shopee SG and 1688 provider results into the same
   `market_trend_agent_output` and `sourcing_agent_output` fields.
5. Run `npm run check:contract`, `npm run typecheck`, and `npm run build`.

## Demo URLs

- Web mock: `http://localhost:3000`
- API mock: `http://localhost:3000/api/run?mock=1`
