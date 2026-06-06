# Sea Launch AI

> Sea x OpenAI Codex Hackathon - commerce track

Sea Launch AI is an AI-native commerce operations system for lightweight sellers. A seller starts with one product direction, and a multi-agent commerce team turns it into a Shopee-ready business judgment and listing package: market signal, sourcing, margin, risk, listing, packaging, and final investment decision.

Slogan:

```txt
Zero-person company. One AI commerce team. Endless product opportunities.
```

## MVP

The 24h MVP only supports:

- Product: `Mini Desk Vacuum`
- Platform: `Shopee`
- Market: `Singapore`
- Language: English
- Demo decision: `Watch`, not `Go`

The live demo must show the important business moment:

```txt
Mini Desk Vacuum
  -> Risk flags exaggerated suction and electrical / USB safety review
  -> Margin shows base around 28% and bad case around 12%
  -> Committee returns Watch because profit is sensitive and compliance needs review
```

## Main Documents

Only these three documents are the source of truth:

| Document | Purpose |
| --- | --- |
| [README.md](README.md) | Project introduction and MVP story |
| [docs/IMPLEMENTATION-ROADMAP.md](docs/IMPLEMENTATION-ROADMAP.md) | Unified roadmap: architecture, contract plan, agent skills/tools/harness, audit, definition of done |
| [docs/TASKS.md](docs/TASKS.md) | Team execution board and PR-sized TODO list |

## Technical Direction

- Next.js 14 App Router, TypeScript, Tailwind.
- OpenAI Responses API with Structured Outputs and Function Calling.
- OpenAI image generation through a dedicated Packaging Agent.
- Contract-first integration through `contract/result.ts`, `contract/result.schema.json`, and `contract/mock-result.json`.
- `/api/run?mock=1` must always return the mock result instantly.

Start with the roadmap, then claim work from the task board.
