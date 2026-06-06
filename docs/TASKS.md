# Sea Launch AI Task Board

> This is the working TODO list. The implementation details live in [IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md).

## Working Rules

- Keep `main` demo-safe.
- Use one branch per task.
- Contract changes must update all three files together:
  - `contract/result.ts`
  - `contract/result.schema.json`
  - `contract/mock-result.json`
- Run `node scripts/check-contract.mjs` after every contract or mock change.
- `POST /api/run?mock=1` must always work.
- Every agent must have `skill.ts`, `tools.ts`, `schema.ts`, `harness.ts`, and `index.ts`.

## Owners

| Role | Focus |
| --- | --- |
| P1 AI / Backend | contract, runtime, providers, agents, `/api/run`, audit |
| P2 Frontend | Seller Brief, Agent War Room, run state |
| P3 Frontend / Data | Opportunity Board, Listing Studio, seed fixtures, images |
| P4 Product / Demo | story, QA, pitch, fallback recording |

## Dependency Map

```txt
TASK-01 Contract
  -> TASK-02 Skeleton + mock API
  -> TASK-03 Runtime + audit
  -> TASK-04 Providers + seed
  -> TASK-05 Market Agent
  -> TASK-06 Sourcing Agent
  -> TASK-07 Margin + Risk Agents
  -> TASK-08 Listing Agent
  -> TASK-09 Packaging Agent + live images
  -> TASK-10 Committee Agent
  -> TASK-11 Real /api/run integration

Frontend can start after TASK-02 using contract/mock-result.json:
TASK-12 Brief + War Room
TASK-13 Opportunity Board + Listing Studio + ROI

QA and pitch run across the whole project:
TASK-14 Harness + CI
TASK-15 Live demo hardening
```

## TASK-01 · Contract 7-Agent Update · P1

Paths:

- `contract/result.ts`
- `contract/result.schema.json`
- `contract/mock-result.json`
- `scripts/check-contract.mjs` if needed

Requirements:

- Add `packaging` to `AgentKey`.
- Add `audit_run_id` to `RunResult`.
- Keep final output contract-first and frontend-safe.
- Add Packaging Agent to `agents[]`.
- Move image ownership to Packaging Agent while keeping UI field `selected_listing.images[]`.
- Keep Mini Desk Vacuum primary decision as `Watch`.

Acceptance:

- `node scripts/check-contract.mjs` passes.
- Mock contains 7 agents.
- War Room can render Market, Sourcing, Margin, Risk, Listing, Packaging, Committee.

## TASK-02 · Next.js Skeleton + Mock API · P1/P2

Paths:

- `app/`
- `components/`
- `lib/openai.ts`
- `package.json`
- `tsconfig.json`
- `tailwind.config.*`
- `.env.example`

Requirements:

- Build Next.js 14 App Router skeleton.
- Configure TypeScript and Tailwind.
- Add placeholder routes for Brief, War Room, Opportunity Board, Listing Studio, ROI/Admin.
- Implement `POST /api/run?mock=1` by returning `contract/mock-result.json`.
- Import types from `contract/result.ts`.

Acceptance:

- `npm run dev` starts.
- `/api/run?mock=1` returns a valid full result.

## TASK-03 · Agent Runtime + Audit · P1

Paths:

- `lib/agent-runtime/run-agent.ts`
- `lib/agent-runtime/tool-runner.ts`
- `lib/agent-runtime/audit.ts`
- `lib/agent-runtime/schemas.ts`
- `lib/agent-runtime/errors.ts`
- `lib/agent-runtime/replay.ts`
- `lib/openai.ts`

Requirements:

- Wrap OpenAI Responses API.
- Enforce Structured Outputs.
- Support Function Calling / ReAct-style tool loops.
- Record audit snapshots for agent inputs, tool calls, model response ids, parsed outputs, validation, latency, and cost.
- Support modes: `mock`, `fixture`, `live`.

Acceptance:

- A fake agent can call a fake tool, return strict JSON, validate schema, and write audit.

## TASK-04 · Provider Adapters + Seed Data · P1/P3

Paths:

- `lib/providers/shopee/*`
- `lib/providers/sourcing-1688/*`
- `lib/providers/shipping/*`
- `lib/providers/fx/*`
- `seed/**/*`

Requirements:

- Implement provider interfaces:
  - `shopee.searchProducts`
  - `shopee.getProductDetail`
  - `shopee.getCategoryAttributes`
  - `shopee.getPolicyRules`
  - `sourcing.searchOffers`
  - `sourcing.getOfferDetail`
  - `shipping.estimateCrossBorder`
  - `fx.convert`
- Add Mini Desk Vacuum Shopee SG seed fixtures.
- Add 1688 supplier seed fixtures.
- Add shipping and FX assumptions.
- Keep source links or fixture ids in every tool output.

Acceptance:

- Market and Sourcing can run without network.
- Audit shows which fixture/source each signal came from.

## TASK-05 · Market Trend Agent · P1

Paths:

- `lib/agents/market/skill.ts`
- `lib/agents/market/tools.ts`
- `lib/agents/market/schema.ts`
- `lib/agents/market/harness.ts`
- `lib/agents/market/index.ts`

Skill:

- Judge Shopee SG demand for Mini Desk Vacuum.
- Estimate demand signal, competitor count, price band, review density, rating distribution, trend links.
- Never claim fake monthly sales.

Tools:

- `shopee.searchProducts`
- `shopee.getProductDetail`
- optional `shopee.getCategoryAttributes`

Acceptance:

- Harness confirms `competitor_count > 0`.
- Every evidence item has a source or fixture id.
- Output can feed Sourcing and Packaging style notes.

## TASK-06 · Sourcing Agent · P1

Paths:

- `lib/agents/sourcing/skill.ts`
- `lib/agents/sourcing/tools.ts`
- `lib/agents/sourcing/schema.ts`
- `lib/agents/sourcing/harness.ts`
- `lib/agents/sourcing/index.ts`

Skill:

- Find low-cost, fulfillable supplier candidates.
- Output source price, stock, MOQ, domestic dispatch, package weight, dimensions, and fulfillment warnings.

Tools:

- `sourcing.searchOffers`
- `sourcing.getOfferDetail`
- `fx.convert`
- `shipping.estimateCrossBorder`

Acceptance:

- `source_price > 0`.
- MOQ, stock, weight, and dimensions are present.
- Fulfillment warning appears if delivery exceeds user max.

## TASK-07 · Margin + Risk Agents · P1

Paths:

- `lib/agents/margin/skill.ts`
- `lib/agents/margin/tools.ts`
- `lib/agents/margin/schema.ts`
- `lib/agents/margin/harness.ts`
- `lib/agents/margin/index.ts`
- `lib/agents/risk/skill.ts`
- `lib/agents/risk/tools.ts`
- `lib/agents/risk/schema.ts`
- `lib/agents/risk/harness.ts`
- `lib/agents/risk/index.ts`

Margin Skill:

- Deterministically calculate gross margin, net profit, and net margin.
- Produce low/base/high scenarios.
- Let LLM explain sensitivity only; do not let the model calculate money.

Margin Tools:

- deterministic cost model
- `shipping.estimateCrossBorder`
- `fx.convert`
- `risk.checkpoint("margin")`

Risk Skill:

- Act as cross-cutting compliance supervisor.
- Run checkpoints at `margin`, `listing`, `packaging`, and `committee`.
- Flag exaggerated suction and electrical / USB safety review.

Risk Tools:

- `shopee.getPolicyRules`
- listing violation rule matcher
- claim checker
- category validator
- image compliance checker

Acceptance:

- Mini Desk Vacuum base margin is around 28%.
- Bad case margin is around 12%.
- Risk level is `medium`.
- `human_review_required = true`.
- No hard prohibited flag unless a real rule supports it.

## TASK-08 · Listing Agent · P1

Paths:

- `lib/agents/listing/skill.ts`
- `lib/agents/listing/tools.ts`
- `lib/agents/listing/schema.ts`
- `lib/agents/listing/harness.ts`
- `lib/agents/listing/index.ts`

Skill:

- Produce Shopee-ready structured listing fields.
- Generate safe English title, bullets, description, SKU, variations, category attributes, logistics, and missing fields.
- Do not generate images.

Tools:

- `shopee.getCategoryAttributes`
- title validator
- description validator
- SKU / variation normalizer
- `risk.checkpoint("listing")`

Acceptance:

- Required fields are filled or explicitly listed as missing.
- Risk warnings are reflected in wording.
- No exaggerated claims appear in title or description.

## TASK-09 · Packaging Agent + Live Images · P1/P3

Paths:

- `lib/agents/packaging/skill.ts`
- `lib/agents/packaging/tools.ts`
- `lib/agents/packaging/schema.ts`
- `lib/agents/packaging/harness.ts`
- `lib/agents/packaging/index.ts`
- `lib/providers/openai-image/*`
- `public/generated/*`
- `seed/images/*`

Skill:

- Create localized Shopee SG packaging angle.
- Generate hero, lifestyle, and feature image prompts.
- Generate live product images through OpenAI.
- Attach image compliance notes.

Tools:

- competitor style extractor
- prompt constraint builder
- `openaiImage.generateProductImage`
- `openaiImage.editProductImage`
- `openaiImage.checkImageCompliance`
- `risk.checkpoint("packaging")`

Acceptance:

- Dry-run mode creates prompts without image API calls.
- Live mode generates or gracefully falls back for 3 image slots.
- Prompts only contain real product attributes.
- Prompts avoid "super suction", "industrial grade", fake certification, and unsupported battery claims.

## TASK-10 · Committee Agent · P1

Paths:

- `lib/agents/committee/skill.ts`
- `lib/agents/committee/tools.ts`
- `lib/agents/committee/schema.ts`
- `lib/agents/committee/harness.ts`
- `lib/agents/committee/index.ts`

Skill:

- Act as CEO / investment committee.
- Deterministically combine scores and gates.
- Use LLM only for explanation or Devil's Advocate summary.

Tools:

- deterministic scoring function
- deterministic gate evaluator
- `risk.checkpoint("committee")`
- optional LLM summary generator

Acceptance:

- Mini Desk Vacuum returns `Watch`.
- High-risk products cannot become `Go`.
- Decision reason mentions profit sensitivity and compliance review.

## TASK-11 · Real API Integration · P1

Paths:

- `app/api/run/route.ts`
- `app/api/runs/[id]/audit/route.ts`
- `lib/agent-runtime/*`
- `lib/agents/*`
- `contract/*`

Requirements:

- Wire pipeline:
  `market -> sourcing -> margin -> listing -> packaging -> committee`
- Invoke Risk checkpoints during margin, listing, packaging, committee.
- Support:
  - `POST /api/run?mock=1`
  - `POST /api/run?images=0`
  - `POST /api/run`
  - `GET /api/runs/:id/audit`
- Validate final result against contract schema.

Acceptance:

- Mock mode is instant.
- Text-only live mode works.
- Full live mode attempts image generation.
- Audit endpoint explains the run.

## TASK-12 · Frontend Brief + War Room · P2

Paths:

- `app/*`
- `components/*`

Requirements:

- English Seller Brief with MVP defaults.
- War Room renders 7 agent cards.
- Risk card shows checkpoint timeline.
- Cards show waiting/running/done/blocked, evidence, scores, warnings, confidence.

Acceptance:

- Frontend can run against `contract/mock-result.json`.
- Demo visibly shows agent collaboration and conflict.

## TASK-13 · Frontend Board + Listing Studio + ROI · P2/P3

Paths:

- `app/*`
- `components/*`

Requirements:

- Opportunity Board renders Go/Watch/Reject cards.
- Margin chart shows low/base/high.
- Listing Studio shows Shopee fields, safe copy, generated images, prompts, compliance notes, and copyable JSON.
- ROI/Admin Summary shows time saved, risks blocked, reusable prompt/template, and next monitoring items.

Acceptance:

- User can move from Brief to War Room to Board to Listing Studio.
- Watch decision is visually understandable.

## TASK-14 · Harness + CI · P1/P3

Paths:

- `lib/agents/*/harness.ts`
- `scripts/*`
- `.github/workflows/*`

Requirements:

- Add fixture harness for each agent.
- Add deterministic tests for margin and committee.
- Keep contract check in CI.
- Live smoke tests must be opt-in, not required for every PR.

Acceptance:

- Fixture harness validates all agents locally.
- Contract drift fails PR checks.

## TASK-15 · Live Demo + Pitch · P4

Paths:

- `docs/IMPLEMENTATION-ROADMAP.md`
- local demo assets if needed

Requirements:

- Rehearse mock path.
- Rehearse live text path.
- Rehearse live image path.
- Capture fallback recording/screenshots.
- Prepare 3-minute pitch around "profit-aware before copywriting".

Acceptance:

- Demo survives network/model/image failure.
- Pitch clearly explains why `Watch` is the correct trusted decision.
