# Standalone Mock Workspace

This directory contains a standalone mock for the Shopee SG market signals and
1688 sourcing signals demo.

It intentionally does not modify the main project files under `app/`,
`contract/`, `lib/`, or `docs/`.

## What Is Mocked

- Product directions from the user-provided screenshot.
- Market Trend Agent output for Shopee SG.
- Sourcing Agent output for 1688.
- 7-agent demo status cards.
- Opportunity board, margin snapshot, and Shopee listing draft.

No live Shopee, Shopee Ads, Seller Centre, web search, or 1688 calls are made.

## Files

- `index.html`: standalone mock webpage.
- `styles.css`: standalone webpage styles.
- `app.js`: renders the page from mock JSON.
- `data/signals.json`: all mock data.
- `assets/*.svg`: copied seed assets used by the mock listing studio.

## Run Locally

From the repository root:

```powershell
python -m http.server 4000 -d mock
```

Then open:

```text
http://localhost:4000
```

If Python is unavailable, any static file server can serve the `mock/`
directory. The page uses `fetch("./data/signals.json")`, so it should be served
over `http://` instead of opened directly as a `file://` URL.

## Mock Boundary

The mock data shape is deliberately richer than the current root contract so the
demo can show the exact fields requested for:

- `market_trend_agent_output`
- `sourcing_agent_output`
- `product_directions`

When real providers are ready, move the selected fields from
`mock/data/signals.json` into the production contract and provider pipeline in a
separate implementation PR.
