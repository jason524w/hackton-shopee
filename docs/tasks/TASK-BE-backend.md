# 后端总轨 — 已拆成 9 个并行 PR

> ⚠️ 旧的"单个后端 epic"已**作废**。团队选了**完整 ROADMAP**,后端按
> [IMPLEMENTATION-ROADMAP.md](../IMPLEMENTATION-ROADMAP.md) §13 拆成 9 个独立 PR,
> 每个 PR 独占自己的目录,可多 agent 并行。**实现细节、目录规范、harness、audit 要求全部以 ROADMAP 为权威。**

## 9 个后端 PR(独占路径 → 不冲突)

| Issue | 独占路径 | 依赖 |
|---|---|---|
| TASK-RUNTIME-AUDIT | `lib/agent-runtime/**` | 骨架 |
| TASK-PROVIDERS | `lib/providers/{shopee,sourcing-1688,shipping,fx}/**` | 骨架 + seed 数据 |
| TASK-MARGIN-RISK | `lib/agents/margin/**` `lib/agents/risk/**` | runtime + providers + contract |
| TASK-MARKET-SOURCING | `lib/agents/market/**` `lib/agents/sourcing/**` | runtime + providers + contract |
| TASK-LISTING | `lib/agents/listing/**` | runtime + providers + risk checkpoint |
| TASK-PACKAGING-IMAGE | `lib/agents/packaging/**` `lib/providers/openai-image/**` | runtime + risk checkpoint |
| TASK-COMMITTEE | `lib/agents/committee/**` | margin/risk/listing 产物 + [COMMITTEE.md](../COMMITTEE.md) |
| TASK-API-INTEGRATION | `app/api/run/**` `app/api/runs/[id]/audit/**` | 上述全部 |
| TASK-HARNESS-QA | `tests/**` + smoke checklist | 各 agent harness |

## 公共铁律
- 每个 agent 目录遵循同一模板:`skill / schema / tools / harness / index`(见 ROADMAP §4)。
- agent 只导入 provider 适配器,**不直接碰 SDK / HTTP**。
- Risk 是跨切 checkpoint supervisor(ROADMAP §7),其 API 改动需 margin/listing/packaging/committee owner 知会。
- **任何时候 `/api/run` 最终 `RunResult` 必须通过 `scripts/check-contract.mjs`**(7 agent + audit_run_id)。
- 不移除 `/api/run?mock=1`;Committee 不得静默翻 Risk 硬 gate。
