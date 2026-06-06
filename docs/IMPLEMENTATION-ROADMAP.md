# Sea Launch AI Implementation Roadmap

> Backend / agent implementation plan for the 24h MVP.
> This document is intentionally detailed so multiple teammates or agents can work in parallel without guessing ownership boundaries.

## 0. MVP Decision

First MVP scope is fixed:

- Product: Mini Desk Vacuum
- Platform: Shopee
- Market: Singapore
- UI language: English
- Main demo path: live OpenAI text agents + live image generation
- Demo decision: Committee returns **Watch**, not Go

The demo climax must still land:

1. User starts with Mini Desk Vacuum.
2. Risk supervision flags exaggerated suction claims and electrical / USB safety review.
3. Margin shows base case around 28% but bad / high-return case around 12%.
4. Committee explains why this is a Watch opportunity, not an automatic Go.

## 1. Target Agent Architecture

The production pipeline is linear, but Risk is a cross-cutting supervisor:

```txt
market -> sourcing -> margin -> listing -> packaging -> committee
                     ^          ^          ^            ^
                     |          |          |            |
                   risk checkpoint supervisor
```

Risk is still an independent agent in the contract and UI, but it does not behave like a single ordinary sequential stage. Instead, it runs checkpoint reviews during Margin, Listing, Packaging, and Committee.

### Agent Order In RunResult

`RunResult.agents[]` should display seven agents in this order:

```txt
market
sourcing
margin
risk
listing
packaging
committee
```

Risk appears after Margin in the UI because that is where the first strong conflict becomes visible, but its evidence is aggregated from all risk checkpoints.

## 2. Contract-First Changes

Changing the agent list triggers the contract-first rule. Update all three files together:

- `contract/result.ts`
- `contract/result.schema.json`
- `contract/mock-result.json`

### Required Type Changes

`AgentKey` must become:

```ts
export type AgentKey =
  | "market"
  | "sourcing"
  | "margin"
  | "risk"
  | "listing"
  | "packaging"
  | "committee";
```

Add an audit pointer to the main result:

```ts
export interface RunResult {
  run_id: string;
  audit_run_id: string;
  created_at: string;
  currency: string;
  brief: Brief;
  agents: AgentResult[];
  opportunities: Opportunity[];
  committee: Committee;
  selected_listing: SelectedListing;
}
```

Do not put full audit logs into `RunResult`. Use `audit_run_id` and expose audit details through:

```txt
GET /api/runs/:id/audit
```

### Selected Listing Image Ownership

`selected_listing.images[]` is now owned by Packaging Agent, not Listing Agent.

The existing `ListingImage` shape can stay:

```ts
export interface ListingImage {
  type: "hero" | "lifestyle" | "feature";
  url: string;
  prompt: string;
  compliance: "ok" | "needs_review" | "rejected";
}
```

For MVP, avoid expanding `SelectedListing` unless the frontend explicitly needs more fields. Packaging notes can be represented through:

- `images[].prompt`
- `images[].compliance`
- `selected_listing.compliance.warnings`
- audit detail endpoint

### Schema Strictness

`contract/result.schema.json` should be strict enough for backend validation:

- Add `packaging` to the agent enum.
- Add `audit_run_id` to top-level `required`.
- Include `seller_type` in `brief.required`.
- Prefer `additionalProperties: false` for every contract object that is not explicitly a free-form map.
- Keep `attributes` and `committee.weights` flexible only where necessary.

### Mock Update Rules

`contract/mock-result.json` must remain the frontend and demo fallback source:

- Add `audit_run_id`.
- Add a Packaging Agent card.
- Keep Mini Desk Vacuum primary opportunity decision as `Watch`.
- Keep Risk Agent `risk_level = "medium"`.
- Keep the required risk warnings:
  - exaggerated suction claims
  - electrical / USB power safety review
- Keep margin story:
  - base net margin around 28%
  - bad / high-return case around 12%

## 3. Repository Layout

Use this layout for backend implementation:

```txt
lib/
  agent-runtime/
    run-agent.ts
    tool-runner.ts
    audit.ts
    schemas.ts
    errors.ts
    replay.ts

  providers/
    shopee/
      index.ts
      seed.ts
      types.ts
    sourcing-1688/
      index.ts
      seed.ts
      types.ts
    shipping/
      index.ts
      seed.ts
      types.ts
    fx/
      index.ts
      seed.ts
      types.ts
    openai-image/
      index.ts
      types.ts

  agents/
    market/
      skill.ts
      schema.ts
      tools.ts
      harness.ts
      index.ts
    sourcing/
      skill.ts
      schema.ts
      tools.ts
      harness.ts
      index.ts
    margin/
      skill.ts
      schema.ts
      tools.ts
      harness.ts
      index.ts
    risk/
      skill.ts
      schema.ts
      tools.ts
      checkpoints.ts
      harness.ts
      index.ts
    listing/
      skill.ts
      schema.ts
      tools.ts
      harness.ts
      index.ts
    packaging/
      skill.ts
      schema.ts
      tools.ts
      harness.ts
      index.ts
    committee/
      skill.ts
      schema.ts
      tools.ts
      harness.ts
      index.ts

seed/
  market/
    mini-desk-vacuum-shopee-search.json
    mini-desk-vacuum-competitor-details.json
  sourcing/
    mini-desk-vacuum-1688-offers.json
  rules/
    shopee-sg-policy-rules.json
    shopee-sg-listing-violations.json
  shipping/
    cn-to-sg-small-parcel.json
  fx/
    cny-sgd.json
  images/
    source-product/
      mini-desk-vacuum-source.png
```

Generated images should be written under `public/generated/<run_id>/` so the frontend can render them directly.

## 4. Agent Module Contract

Every agent directory must follow the same pattern.

### `skill.ts`

Contains agent role, policies, scoring rules, ReAct loop instructions, stopping rules, and output expectations.

Required exports:

```ts
export const agentSkill = {
  key: "market",
  name: "Market Trend Agent",
  version: "2026-06-06.1",
  role: "...",
  systemPrompt: "...",
  policies: ["..."],
  scoringRules: ["..."],
  stopWhen: ["..."],
};
```

Rules:

- Do not bury business rules only in prompts when code can enforce them.
- Stable policy text should live here so audit can record the skill version.
- Prompts must say the agent can only use provided data and tool outputs.

### `schema.ts`

Contains input and output schemas.

Required exports:

```ts
export const inputSchema = ...
export const outputSchema = ...
export type AgentInput = ...
export type AgentOutput = ...
```

Rules:

- Prefer Zod as source of truth if the app uses Zod.
- Generate JSON Schema from Zod when calling Structured Outputs.
- All model outputs must be parsed and validated before entering the next agent.
- Output schema must include enough evidence to render War Room and audit.

### `tools.ts`

Defines the tools the agent can call.

Required exports:

```ts
export const tools = [...]
```

Rules:

- Agents only receive tools for their own job.
- Tools call provider adapters, not raw external APIs.
- Every tool must return structured output with source metadata.
- Every tool call must be recorded by audit.

### `harness.ts`

Contains fixture replay and assertions.

Required exports:

```ts
export async function replayFixture(...)
export async function assertOutput(...)
```

Rules:

- Harness should run without live OpenAI when possible.
- Use deterministic fixtures for seed-backed tools.
- Packaging must support dry-run mode without image API calls.
- Harness assertions should encode demo-critical behavior.

### `index.ts`

Public agent runner.

Required exports:

```ts
export async function runMarketAgent(input, context): Promise<MarketOutput>
```

Rules:

- `index.ts` is the only file imported by the pipeline.
- It wires skill, schema, tools, runtime, harness mode, and audit.
- It should not contain large prompt strings or provider-specific details.

## 5. ReAct Loop Runtime

Each agent runs an internal ReAct-style tool loop:

```txt
input
  -> model reads skill and current state
  -> model chooses a tool call or final answer
  -> tool-runner executes allowed tool
  -> audit records tool input/output
  -> model observes tool output
  -> repeat until final structured JSON
  -> schema validation
  -> audit records parsed output
```

Implementation belongs in:

```txt
lib/agent-runtime/run-agent.ts
lib/agent-runtime/tool-runner.ts
```

Runtime requirements:

- Support `maxToolCalls`.
- Support per-agent timeout.
- Support one automatic retry after schema validation failure.
- Support dry-run fixture replay.
- Support `images=0` for text-only pipeline rehearsal.
- Return structured errors that can be converted into blocked agent results.
- Never expose hidden model reasoning in audit logs.

## 6. Provider Adapter Requirements

Provider adapters isolate external systems. Agents must never import SDKs or raw HTTP clients directly.

### Shopee Provider

Required functions:

```ts
shopee.searchProducts(query, market, category)
shopee.getProductDetail(itemId)
shopee.getCategoryAttributes(categoryId)
shopee.getPolicyRules(market)
```

Seed-backed implementation:

- Reads `seed/market/mini-desk-vacuum-shopee-search.json`.
- Reads `seed/market/mini-desk-vacuum-competitor-details.json`.
- Reads `seed/rules/shopee-sg-policy-rules.json`.
- Reads `seed/rules/shopee-sg-listing-violations.json`.

Output must include:

- source label
- source URL when available
- captured_at
- normalized product fields
- raw snapshot id

### Sourcing 1688 Provider

Required functions:

```ts
sourcing.searchOffers(query)
sourcing.getOfferDetail(offerId)
```

Seed-backed implementation:

- Reads `seed/sourcing/mini-desk-vacuum-1688-offers.json`.

Output must include:

- offer id
- source price
- MOQ
- stock
- supplier location
- domestic shipping estimate
- package weight and dimensions
- source URL when available

### Shipping Provider

Required function:

```ts
shipping.estimateCrossBorder(weight, dimensions, from, to)
```

Output must include:

- low/base/high cost
- estimated days
- assumptions
- source snapshot

### FX Provider

Required function:

```ts
fx.convert(amount, from, to)
```

Output must include:

- converted amount
- rate
- captured_at
- source

For MVP, seed rate is acceptable as long as it is documented.

### OpenAI Image Provider

Required functions:

```ts
openaiImage.generateProductImage(prompt, constraints)
openaiImage.editProductImage(sourceImage, prompt)
openaiImage.checkImageCompliance(imageUrl, rules)
```

Requirements:

- Live mode generates images with OpenAI.
- Dry-run mode returns prompts without API calls.
- Generated images are saved under `public/generated/<run_id>/`.
- Provider returns image URL, prompt, model, response id, and metadata.
- Audit records prompt, constraints, response id, latency, and output path.

## 7. Risk Checkpoint Supervisor

Risk is a normal contract agent but an abnormal runtime participant.

### Directory

```txt
lib/agents/risk/
  skill.ts
  schema.ts
  tools.ts
  checkpoints.ts
  harness.ts
  index.ts
```

### Checkpoint API

```ts
export async function runRiskCheckpoint(
  stage: "margin" | "listing" | "packaging" | "committee",
  payload: unknown,
  context: AgentRunContext
): Promise<RiskCheckpointResult>
```

### Risk Evidence Aggregation

At the end of the pipeline, build one `AgentResult` for Risk by aggregating checkpoint results:

```txt
margin checkpoint evidence
listing checkpoint evidence
packaging checkpoint evidence
committee checkpoint evidence
```

### Risk Checkpoint Stages

`margin` checkpoint:

- Return / damage sensitivity.
- Bad-case margin collapse.
- Misleading profit claims.
- Whether the opportunity should be capped at Watch.

`listing` checkpoint:

- Prohibited / restricted item flags.
- Controlled goods or electrical safety notes.
- Category / attribute mismatch.
- Exaggerated title and description claims.
- Keyword spam.

`packaging` checkpoint:

- Prompt uses only real product attributes.
- Prompt avoids exaggerated suction or industrial claims.
- Generated image does not show nonexistent features.
- Generated image does not imply safety certification.
- Feature image callouts match listing specs.

`committee` checkpoint:

- Hard gates.
- Final human review requirement.
- Ensures high-risk opportunities cannot become Go.

### Required MVP Risk Outcome

For Mini Desk Vacuum:

- `risk_level`: `medium`
- `human_review_required`: `true`
- warning: avoid exaggerated suction claims
- warning: USB / electrical safety review required
- no hard prohibited flag unless a real rule snapshot supports it

## 8. Agent Details

## 8.1 Market Trend Agent

Department: Prediction / Market Intelligence

Purpose:

- Decide whether Shopee SG has real demand signals for Mini Desk Vacuum.
- Identify price band, competitor density, review density, and market heat.
- Produce candidate product directions.

Inputs:

- `Brief`
- target market
- target platform
- category
- product intent
- budget and target margin

Tools:

- `shopee.searchProducts(query, market, category)`
- `shopee.getProductDetail(itemId)`

Output responsibilities:

- `AgentResult` for War Room.
- 3 opportunity directions.
- One primary direction: Mini Desk Vacuum.
- Demand score.
- Competitor count.
- Price band.
- Review density.
- Evidence with source/tool snapshot ids.

Business rules:

- Do not claim real monthly sales unless source data contains it.
- Use review count, rating, listing count, and price band as proxy signals.
- If data is thin, lower confidence and mark as Watch candidate.

Harness fixture:

```txt
seed/market/mini-desk-vacuum-shopee-search.json
```

Harness assertions:

- `competitor_count > 0`
- `price_band.min > 0`
- `price_band.max >= price_band.min`
- every evidence item has a source label or tool snapshot id
- no fake sales claim appears in `key_judgment`
- primary direction id is stable

Audit requirements:

- Store query.
- Store product ids returned by search.
- Store normalized search result summary.
- Store model response id and parsed output.

## 8.2 Sourcing Agent

Department: Customer Service / Supplier Operations

Purpose:

- Find low-cost, fulfillable supply for the primary product.
- Check stock, MOQ, supplier basics, domestic shipping, package weight and dimensions.

Inputs:

- primary market direction
- target market
- budget
- max fulfillment days
- required specs from Market Agent

Tools:

- `sourcing.searchOffers(query)`
- `sourcing.getOfferDetail(offerId)`
- `fx.convert(amount, from, to)`
- `shipping.estimateCrossBorder(weight, dimensions, from, to)`

Output responsibilities:

- supplier candidates
- selected source price in SGD
- MOQ
- available stock
- domestic shipping estimate
- package weight and dimensions
- fulfillment estimate
- sourcing risk warnings

Business rules:

- Source price must be positive.
- Stock and MOQ must be present.
- If fulfillment is close to or above user max, generate a warning.
- Do not choose a supplier only because it is cheapest if specs are missing.

Harness fixture:

```txt
seed/sourcing/mini-desk-vacuum-1688-offers.json
seed/fx/cny-sgd.json
seed/shipping/cn-to-sg-small-parcel.json
```

Harness assertions:

- `source_price > 0`
- MOQ is present
- stock is present
- package weight is present
- dimensions are present
- fulfillment days are present
- if `fulfillment_days > brief.max_fulfillment_days`, warning must exist

Audit requirements:

- Store offer ids.
- Store selected supplier rationale.
- Store FX conversion snapshot.
- Store shipping estimate snapshot.

## 8.3 Margin Agent

Department: Finance

Purpose:

- Calculate actual profit after full estimated cost stack.
- Produce low/base/high margin scenarios.
- Explain sensitivity without letting the model do arithmetic.

Inputs:

- selected supplier output
- suggested market price
- platform fee assumptions
- payment fee assumptions
- GST / tax assumptions
- return and damage assumptions
- packaging and AI operation assumptions

Tools:

- deterministic margin calculator
- `risk.checkpoint("margin")`

Cost formula:

```txt
net_profit =
  target_selling_price
  - source_price
  - international_shipping_cost
  - local_delivery_cost
  - platform_fee
  - payment_fee
  - tax_or_gst_estimate
  - return_loss_reserve
  - damage_loss_reserve
  - packaging_cost
  - ai_operation_cost

net_margin = net_profit / target_selling_price
```

Output responsibilities:

- gross margin
- net profit
- low/base/high margin scenarios
- cost breakdown waterfall lines
- minimum viable price
- financial warnings
- risk checkpoint result

Business rules:

- Code calculates all money fields.
- LLM may explain sensitivity but cannot invent or alter numeric results.
- Low/base/high must use documented assumptions.
- If bad case margin drops below target, Committee cannot automatically Go.

Harness assertions:

- base net margin around 28% for Mini Desk Vacuum mock assumptions
- bad / high-return net margin around 12%
- cost breakdown sum equals net profit within rounding tolerance
- every cost line has label, amount, and type
- risk margin checkpoint runs and records warning for sensitivity

Audit requirements:

- Store all assumptions.
- Store calculator input and output.
- Store risk checkpoint result.
- Store LLM explanation response id if used.

## 8.4 Risk & Compliance Agent

Department: Risk / Compliance

Purpose:

- Supervise risky parts of the workflow.
- Identify platform, product, listing, image, fulfillment, and claim risks.
- Provide hard gates to Committee.

Inputs:

- stage-specific payloads from Margin, Listing, Packaging, Committee
- Shopee policy rules
- listing violation rules
- product category data
- generated listing and image outputs

Tools:

- `shopee.getPolicyRules(market)`
- listing claim checker
- category attribute checker
- image compliance checker through OpenAI image provider when needed

Output responsibilities:

- checkpoint results
- aggregated Risk AgentResult
- `risk_level`
- `human_review_required`
- warnings
- blocked reasons, if any

Business rules:

- Medium risk can continue but must be visible.
- Hard prohibited or unsupported controlled goods can force Reject.
- No hard prohibited flag without a real policy snapshot.
- Risk warnings must be propagated into Listing and Committee.

Harness fixture:

```txt
seed/rules/shopee-sg-policy-rules.json
seed/rules/shopee-sg-listing-violations.json
```

Harness assertions:

- Mini Desk Vacuum triggers exaggerated suction warning.
- Mini Desk Vacuum triggers electrical / USB power review warning.
- Mini Desk Vacuum risk level is medium.
- human review is required.
- hard prohibited is false unless backed by fixture rule.
- high-risk synthetic product cannot become Go in Committee.

Audit requirements:

- Store policy rule ids used.
- Store stage payload snapshot id.
- Store checkpoint output.
- Store final aggregated risk result.

## 8.5 Listing Ranker Agent

Department: Marketplace Operations

Purpose:

- Consume upstream canonical opportunity scores and filter candidates before the Packaging Agent prepares the Shopee-ready package.
- Use tool evidence instead of model priors for Singapore demand, sourcing, logistics, FX, policy, local context, and price-change risk.
- Preserve a viable upstream primary/user-selected opportunity for Packaging handoff even when a safer candidate ranks higher.
- Do not replace Market `is_primary` or Committee final ranking.

Inputs:

- opportunities
- margin output
- market context
- sourcing output
- shipping / FX evidence
- risk constraints
- Shopee category attributes

Tools:

- `shopee.searchProducts(query, market, category)`
- `sourcing1688.searchOffers(query)` / `sourcing1688.getOfferDetail(offerId)`
- `shipping.estimateCrossBorder(...)`
- `fx.convert(...)`
- `shopee.getPolicyRules(market)`
- `shopee.getCategoryAttributes(categoryId)`
- Singapore market context / recent-signal connector
- `risk.checkpoint("listing")`

Output responsibilities:

- ranked opportunity ids based on upstream canonical score order plus hard filters
- factor diagnostics: demand, profit, sourcing, compliance, fulfillment, market timing, price stability
- filter reasons and tradeoffs
- selected opportunity id for Packaging handoff
- minimal `selected_listing` handoff shell required by current contract

Business rules:

- LLM is not a data source; it may only trade off supplied features and tool results.
- Apply hard gates before fine ranking.
- Do not generate final listing copy, publish, or claim launch readiness.
- Do not generate images; `selected_listing.images[]` remains Packaging-owned.
- Do not mutate `opportunities[].is_primary`; Market owns primary and Margin detail remains attached to that primary.
- Listing handoff must set `editable_json_ready=false`; Packaging owns final readiness.
- If live recent-event evidence is unavailable, keep freshness caveats and do not boost rank from model priors.
- Risk warnings must be preserved in Packaging handoff.

Harness assertions:

- ranked ids exist and filtered candidates have reasons
- selected handoff respects viable upstream primary/user preference
- Market-owned `is_primary` is not rewritten by Listing
- hard-gated opportunities do not move to Packaging automatically
- handoff price matches the selected opportunity suggested price
- handoff is not marked editable/launch-ready before Packaging
- no Packaging-owned images are generated by Listing Ranker
- Singapore/local context caveats are preserved when live trend tools are absent

Audit requirements:

- Store tool evidence summary.
- Store category attribute snapshot.
- Store ranking feature vectors.
- Store listing risk checkpoint result.
- Store Packaging handoff JSON.

## 8.6 Packaging Agent

Department: Marketing / Packaging

Purpose:

- Create localized Shopee-ready product packaging.
- Generate hero, lifestyle, and feature image prompts.
- Generate live product images.
- Attach image compliance notes.

Inputs:

- listing output
- market context
- competitor style evidence
- product specs
- risk constraints
- optional source product image

Tools:

- competitor style extractor
- `openaiImage.generateProductImage(prompt, constraints)`
- `openaiImage.editProductImage(sourceImage, prompt)`
- `openaiImage.checkImageCompliance(imageUrl, rules)`
- `risk.checkpoint("packaging")`

Output responsibilities:

- localized title angle
- platform style notes
- hero image prompt
- lifestyle image prompt
- feature image prompt
- generated image URLs
- image compliance notes
- image metadata in audit
- `selected_listing.images[]`

Business rules:

- Prompts must only include real product attributes.
- Prompts must not imply capabilities not present in source specs.
- Prompts must avoid exaggerated suction and industrial language.
- Feature image callouts must match the listing exactly.
- Generated images that need review can still be returned, but must be marked `needs_review`.

Dry-run mode:

- Generates prompts only.
- Does not call image API.
- Used by harness and fast backend tests.

Live mode:

- Calls OpenAI image generation or editing.
- Saves images under `public/generated/<run_id>/`.
- Calls image compliance checker.
- Returns public URLs.

Harness assertions:

- dry-run mode makes no image API call
- prompt includes product type and real specs
- prompt includes Singapore context where appropriate
- prompt avoids banned exaggerated terms
- generated image metadata is attached to audit in live mode
- feature image compliance can become `needs_review`

Audit requirements:

- Store prompt text.
- Store prompt constraints.
- Store source image id if used.
- Store generated image path.
- Store image model and response id.
- Store image compliance result.

## 8.7 Committee Agent

Department: CEO / Investment Committee

Purpose:

- Merge all agent outputs.
- Apply hard gates and weighted scoring.
- Produce final Go / Watch / Reject decision and ranking.

Inputs:

- Market output
- Sourcing output
- Margin output
- Risk checkpoint aggregate
- Listing output
- Packaging output
- user constraints

Tools:

- deterministic scoring calculator
- `risk.checkpoint("committee")`
- optional LLM explanation writer

Weights:

```txt
profit: 30%
demand: 25%
compliance: 20%
fulfillment: 15%
packaging: 10%
```

Hard gates:

- prohibited / restricted item
- unresolved IP or brand infringement
- generated images materially mismatch product
- fulfillment cannot satisfy user constraint
- required listing fields missing
- high compliance risk without review path

Output responsibilities:

- ranked opportunity ids
- final decision per opportunity
- tradeoffs
- summary
- decision reason
- final risk-aware recommendation

Business rules:

- High profit cannot override high compliance risk.
- High demand cannot override impossible fulfillment.
- Medium risk Mini Desk Vacuum must be Watch, not Go.
- Low-risk cable organizer can outrank Mini Desk Vacuum.

Harness assertions:

- Mini Desk Vacuum decision is Watch.
- Decision reason mentions profit sensitivity.
- Decision reason mentions compliance / human review.
- High-risk product cannot become Go.
- Ranking respects hard gates.

Audit requirements:

- Store all score inputs.
- Store hard gate evaluation.
- Store final deterministic score.
- Store LLM explanation response id if used.

## 9. API Roadmap

### `POST /api/run`

Main live pipeline.

Query params:

```txt
?mock=1      return contract/mock-result.json immediately
?images=0    run text agents and packaging prompt dry-run, skip live image generation
?replay=<audit_run_id> replay from audit snapshot when supported
```

Response:

```ts
RunResult
```

Requirements:

- Always validate result against `contract/result.schema.json` before returning.
- Return `audit_run_id`.
- In live mode, run all text agents through OpenAI.
- In image live mode, generate Packaging images live.
- If image generation fails, return prompt plus fallback image and mark `needs_review`.
- If an agent fails after retry, convert to blocked agent result only if the contract can still be valid.

### `GET /api/runs/:id/audit`

Returns audit details for debugging and demo proof.

Should include:

- run id
- agent versions
- step timings
- tool calls
- normalized tool outputs
- schema validation results
- warnings and errors
- model response ids

Should not include:

- API keys
- raw secret env values
- hidden model reasoning
- unnecessary full prompt dumps if they contain sensitive user input

## 10. Audit Trail Requirements

Every `/api/run` records:

```txt
run_id
audit_run_id
agent_key
agent version / skill version
input snapshot
tool calls
normalized tool output
model response id
parsed JSON output
schema validation result
latency
token usage / cost estimate when available
warnings
errors
```

Audit storage for MVP can be file-based:

```txt
.runs/
  <audit_run_id>/
    manifest.json
    market.json
    sourcing.json
    margin.json
    risk.json
    listing.json
    packaging.json
    committee.json
```

If `.runs/` should not be committed, add it to `.gitignore` once the app skeleton exists.

## 11. Test And Harness Plan

### Contract Tests

- `contract/mock-result.json` validates against schema.
- A captured live result validates against schema.
- Every `AgentKey` in mock is valid.
- `agents[]` includes exactly seven expected agent keys.

### Unit Tests

Margin:

- exact cost formula
- low/base/high scenario logic
- cost breakdown sum

Risk:

- exaggerated claim detection
- electrical / USB review warning
- hard prohibited gate only when fixture supports it

Committee:

- weighted score
- hard gate override
- Mini Desk Vacuum Watch decision

### Harness Tests

Market:

- fixture replay from Shopee search seed

Sourcing:

- fixture replay from 1688 offers seed

Listing:

- required field completion
- banned claim removal

Packaging:

- dry-run prompt generation
- banned term assertions
- image metadata assertions in live smoke mode

Risk:

- each checkpoint can be tested independently
- aggregate Risk AgentResult includes all checkpoint evidence

### Live Smoke Tests

Run before demo:

```txt
POST /api/run?mock=1
POST /api/run?images=0
POST /api/run
GET /api/runs/:audit_run_id/audit
```

Acceptance:

- mock path returns immediately
- text-only live path completes
- full live path generates or gracefully falls back on images
- audit endpoint can explain the run

## 12. Implementation Phases

### Phase 0: Contract Update

Owner: Integrator / Backend

Tasks:

- Add Packaging Agent to contract.
- Add `audit_run_id`.
- Update mock.
- Validate contract.

Done when:

- Mock validates.
- Frontend can render seven agents from mock.

### Phase 1: Runtime Skeleton

Owner: Backend Runtime

Tasks:

- Implement `run-agent.ts`.
- Implement `tool-runner.ts`.
- Implement `audit.ts`.
- Implement `errors.ts`.
- Implement replay placeholder.

Done when:

- A fake agent can run with a fake tool and produce an audited schema-validated output.

### Phase 2: Provider Stubs

Owner: Provider / Data

Tasks:

- Implement seed-backed Shopee provider.
- Implement seed-backed 1688 provider.
- Implement seed-backed shipping provider.
- Implement seed-backed FX provider.
- Implement OpenAI image provider interface with dry-run mode.

Done when:

- Each provider has at least one fixture-backed test or harness assertion.

### Phase 3: Finance And Risk Core

Owner: Backend / Risk

Tasks:

- Implement deterministic margin calculator.
- Implement Risk checkpoint framework.
- Implement margin checkpoint.
- Implement risk aggregation.

Done when:

- Mini Desk Vacuum margin story is stable.
- Risk catches required warnings.

### Phase 4: Market And Sourcing Agents

Owner: Agent Worker

Tasks:

- Implement Market Agent module.
- Implement Sourcing Agent module.
- Add fixtures and harness assertions.

Done when:

- Market and Sourcing produce valid structured outputs from fixtures.

### Phase 5: Listing Agent

Owner: Agent Worker

Tasks:

- Implement Shopee listing generation.
- Implement title and description validators.
- Wire listing risk checkpoint.

Done when:

- Listing fields are complete.
- No exaggerated claim remains in title or description.

### Phase 6: Packaging Agent

Owner: Agent Worker / Image

Tasks:

- Implement prompt generation dry-run.
- Implement live OpenAI image generation.
- Save images under `public/generated/<run_id>/`.
- Wire image compliance check.
- Wire packaging risk checkpoint.

Done when:

- Dry-run harness passes.
- Full live smoke creates hero/lifestyle/feature outputs or marked fallbacks.

### Phase 7: Committee Agent

Owner: Backend / Decision

Tasks:

- Implement deterministic scoring.
- Implement hard gates.
- Generate decision explanation.
- Wire final risk checkpoint.

Done when:

- Mini Desk Vacuum is Watch.
- Decision reason mentions both profit sensitivity and compliance review.

### Phase 8: API Integration

Owner: Integrator

Tasks:

- Wire `POST /api/run`.
- Wire `GET /api/runs/:id/audit`.
- Add `mock`, `images=0`, and live modes.
- Validate final result.

Done when:

- API returns valid RunResult in all supported modes.

### Phase 9: Demo Hardening

Owner: Whole team

Tasks:

- Run live rehearsal at least five times.
- Capture one successful audit.
- Capture one fallback audit.
- Prepare mock fallback.
- Prepare screenshot / recording fallback.

Done when:

- Demo can survive text model latency, image generation failure, and provider fixture fallback.

## 13. Suggested Pull Request Split

Use separate branches / PRs to avoid file conflicts.

1. `TASK-CONTRACT-7AGENT`
   - Contract files only.

2. `TASK-RUNTIME-AUDIT`
   - `lib/agent-runtime/*`
   - audit storage
   - replay skeleton

3. `TASK-PROVIDERS-SEED`
   - `lib/providers/*`
   - `seed/*`

4. `TASK-MARGIN-RISK`
   - `lib/agents/margin/*`
   - `lib/agents/risk/*`

5. `TASK-MARKET-SOURCING`
   - `lib/agents/market/*`
   - `lib/agents/sourcing/*`

6. `TASK-LISTING`
   - `lib/agents/listing/*`

7. `TASK-PACKAGING-IMAGE`
   - `lib/agents/packaging/*`
   - `lib/providers/openai-image/*`

8. `TASK-COMMITTEE`
   - `lib/agents/committee/*`

9. `TASK-API-INTEGRATION`
   - `app/api/run/route.ts`
   - `app/api/runs/[id]/audit/route.ts`

10. `TASK-HARNESS-QA`
    - tests
    - fixture replay
    - live smoke checklist

## 14. Team Coordination Rules

- Contract changes must be announced because frontend depends on them.
- Provider adapters are shared infrastructure; avoid agent-specific shortcuts inside providers.
- Each agent owns only its own directory.
- Risk checkpoint API is shared; changes require review from Margin, Listing, Packaging, and Committee owners.
- Committee must not silently override Risk hard gates.
- Packaging must not silently accept generated images that fail compliance.
- Audit must be on for live demo runs.
- Do not remove `/api/run?mock=1`.

## 15. Definition Of Done

Backend is MVP-ready when:

- `RunResult` validates against contract.
- Seven agents appear in `agents[]`.
- Risk evidence aggregates multiple checkpoints.
- Mini Desk Vacuum primary decision is Watch.
- Margin story matches demo (base ~28%, bad case ~12%).
- Live image generation works or falls back visibly.
- Audit endpoint can show tool calls and schema results.
- All harness assertions pass.
- Team can replay a run from audit snapshots.

Demo / frontend is MVP-ready when:

- `node scripts/check-contract.mjs` passes (7 agents agree across `result.ts`, `result.schema.json`, `mock-result.json`).
- `/api/run?mock=1` returns instantly.
- `/api/run?images=0` runs the text pipeline with a prompt-only Packaging Agent.
- Risk Agent flags Mini Desk Vacuum exaggerated suction and electrical/USB safety review.
- Committee Agent deterministically returns `Watch` for Mini Desk Vacuum.
- War Room shows 7 agents with the Risk checkpoint timeline.
- Listing Studio shows Shopee fields, Packaging prompts, generated images, compliance notes, and copyable JSON.

## 16. Environment Variables

`.env.example` is the source of truth for required config; copy it to `.env.local`
(`cp .env.example .env.local`). Target shape for the 7-agent + image + audit pipeline:

```txt
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=gpt-5.5
OPENAI_IMAGE_MODEL=gpt-image-2
DEMO_MOCK_ONLY=false
LIVE_IMAGE_GENERATION=true
PROVIDER_MODE=fixture
AUDIT_STORAGE=local
```

Notes:

- `DEMO_MOCK_ONLY=true` forces `/api/run` to behave like `?mock=1` for an emergency demo
  (the永不可移除的安全网, see CLAUDE.md 铁律 3).
- `LIVE_IMAGE_GENERATION=false` makes the Packaging Agent dry-run prompts and use fallback
  images; equivalent in spirit to `/api/run?images=0`.
- `PROVIDER_MODE=fixture` means Shopee / 1688 data comes from `seed/`, while OpenAI text and
  image calls can still be live.
- `AUDIT_STORAGE=local` writes audit snapshots under the local audit directory (see §10).

## 17. Open-Source / Low-Work Dependencies

Use these to reduce build time:

- Next.js App Router for API routes and pages.
- shadcn/ui dashboard blocks for frontend scaffolding.
- Tailwind for styling.
- Recharts for margin and ROI charts.
- OpenAI official JS SDK for Responses API and image generation.
- Zod for agent input/output schemas.
- `zod-to-json-schema` or hand-authored JSON schema for Structured Outputs.
- Vitest for deterministic margin, committee and harness tests.
- Ajv for stronger runtime contract validation once dependencies exist
  (today `scripts/check-contract.mjs` is zero-dependency on purpose).
- `nanoid` or `crypto.randomUUID()` for `audit_run_id`.

Avoid for MVP (consistent with docs/MVP-SCOPE.md "不做"):

- LangChain / CrewAI orchestration.
- A full workflow engine.
- A database dependency before the demo path is stable.
- Real Shopee write-back.

## 18. Golden Demo Script

The on-stage run, end to end:

1. Seller opens Sea Launch AI.
2. Brief is prefilled:
   - target market: Singapore
   - platform: Shopee
   - product: Mini Desk Vacuum
   - target margin: 30%
   - risk appetite: balanced
3. User clicks run.
4. War Room lights up:
   - Market finds demand and price band.
   - Sourcing finds low-price suppliers and packaging dimensions.
   - Margin calculates base around 28%, bad case around 12%.
   - Risk flags the suction claim and USB / electrical review.
   - Listing creates safe Shopee fields.
   - Packaging generates localized prompts and live images.
   - Committee gives Watch.
5. Opportunity Board shows:
   - Mini Desk Vacuum: Watch
   - Cable organizer: Go (or a safer comparison if present)
   - Risky product: Reject
6. Listing Studio shows:
   - editable Shopee fields
   - safe title and description
   - generated image previews
   - compliance notes
   - copyable JSON
7. Audit view shows:
   - tool calls
   - OpenAI response ids
   - image generation metadata
   - risk checkpoints

The story is not "AI wrote a listing." The story is:

```txt
AI acted like a small commerce company:
market found demand,
sourcing found supply,
finance found margin sensitivity,
risk stopped unsafe overconfidence,
listing prepared the shelf,
packaging made Shopee-ready visuals,
committee made the business decision.
```
