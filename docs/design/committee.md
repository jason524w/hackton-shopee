# TASK-14 设计 · Committee(seam 对接附录)

> [#14](https://github.com/jason524w/hackton-shopee/issues/14) 的实现落地附录。**业务规则的权威是 [COMMITTEE.md](../COMMITTEE.md)**(两层架构、Gate A/B 清单、Devil、contract 映射);
> 本文只补 COMMITTEE.md **早于 #23 接缝**遗留的缺口:真实签名 + 每个 gate 的具体取数 + primary/全候选分界。
> 配套:[contract/result.ts](../../contract/result.ts)、[lib/agents/contracts.ts](../../lib/agents/contracts.ts)(seam)、[margin-risk.md §5.5](margin-risk.md)(#10 的下游约定)。

## 0. 缺口背景

COMMITTEE.md §7 的签名 `mergeAndGate(agentOutputs)` 是 #23 之前写的。真实运行时,#14 是一个 **`Agent`**,
从 `ctx.results`(`Partial<RunResult>`)+ `ctx.risk.getCheckpoints()` 取数,不是一个自定义 `AgentOutputs`。

## 1. 真实签名(对齐 seam)

```ts
import type { Agent, AgentContext } from "../contracts";
import type { Committee, Decision, Opportunity } from "../../../contract/result";

export const committeeAgent: Agent = async (ctx) => {
  const opps = ctx.results.opportunities ?? [];
  const decided = opps.map((o) => decideOne(o, ctx));     // 加权 + gate
  const ranked = rankByDecisionThenScore(decided);
  const committee = buildCommittee(ranked /*, devilTradeoffs */);
  return { opportunities: decided, committee };
};
```

- 纯确定性,无 IO(Devil 是 P1,见 §5)。
- 返回 `Partial<RunResult>`:`{ opportunities, committee }`。`runPipeline` 的 `mergeRunResultSlice` 按 `id` 合并 opportunities。
- `committee.weights` 由 #14 写入固定常量 `{profit:.30, demand:.25, compliance:.20, fulfillment:.15, packaging:.10}`。

## 2. 关键分界:primary 才有的信号 vs 3 候选都要 gate

contract 里这些字段**只有 primary 有**:`opportunity.margin`(其余 `null`)、`selected_listing`(整体只有一个)、risk checkpoints(supervisor 只在 primary 的 pipeline 上跑过)。
而这些**每个候选都有**:`scores`、`gross_margin`、`risk_level`、`fulfillment_days`、`stock_status`。

> **规则:** 每个候选用**自己的 opportunity 字段** gate;`margin.low`/`missing_fields`/`human_review` 这几条**只对 primary 生效**(其余候选这些信号不存在,跳过该 gate,不误判)。

## 3. Gate 取数表(逐条钉死)

`ctx` = `AgentContext`;`o` = 当前 `Opportunity`;`sl` = `ctx.results.selected_listing`;`cps` = `ctx.risk.getCheckpoints()`。

### Gate A → 直接 Reject(任一命中,覆盖一切)

| 条件 | 取数 | 范围 |
|---|---|---|
| 品牌/IP 侵权 · 禁售/限售 | `cps.some(c => c.hard_block)`(#10 的 deterministic 产 `hard_block`)| primary |
| 图文不符被判违规 | `sl?.images.some(i => i.compliance === "rejected")` | primary |
| 无可行履约 | `o.stock_status === "out"` 或 `o.fulfillment_days > brief.max_fulfillment_days * 2` | 全候选 |

### Gate B → 封顶 Watch(最多 Watch,禁止 Go;A 优先)

| 条件 | 取数 | 范围 |
|---|---|---|
| **悲观档利润低于目标** | `o.margin && o.margin.low.net_margin < brief.target_margin` | **primary**(← demo 高潮)|
| 履约超平台上限 | `o.fulfillment_days > brief.max_fulfillment_days` | 全候选 |
| listing 未 ready | `(sl?.shopee.missing_fields.length ?? 0) > 0` | primary |
| 需人工复核 | `sl?.compliance.human_review_required === true`(无 sl 时 fallback `cps.some(c => c.human_review_required)`)| primary |
| 风险等级高(非硬违规) | `o.risk_level === "high"` | 全候选 |
| 关键数据低置信度 | `agentConfidence(ctx, "margin"|"risk") < 0.5` | 全局 |

> `human_review_required` 的 **canonical 源是 `selected_listing.compliance`**(COMMITTEE.md §6 映射);risk checkpoints 仅作 sl 缺失时的 fallback。

## 4. 决策合成 + 排序(确定性)

```
overall   = Σ(scores[k] * weights[k])           // 四舍五入到整数,写回 o.scores.overall
base      = overall>=70 ? "Go" : overall>=50 ? "Watch" : "Reject"
decision  = anyGateA ? "Reject"
          : anyGateB ? min(base, "Watch")        // 严重度 Go>Watch>Reject,封顶不能升
          : base
ranked_ids: Go > Watch > Reject,同档 overall 降序
```

**demo 强化点:** 吸尘器 `overall = 66·.30+78·.25+58·.20+72·.15+81·.10 = 69.8 → 70`,
即 `base = Go`,**全靠 Gate B(`margin.low 12.4% < target 25%` + `human_review`)把它封到 Watch** ——
让 gate 当"拦住 Go 的手",是最有戏的版本。务必让 overall 取整到 70(≥70 = Go)。

`decision_reason` = 触发的 gate 文案 + 正面理由模板拼接(P1 由 Devil summary 增强);
`key_reasons[]` 取 2–3 条最强信号。

## 5. Devil's Advocate(P1,可降级,先留接口)

`runDevil(summaries) → Tradeoff[]`,失败 → `tradeoffs` 退化为确定性 gate 生成的条目、`summary` 模板拼接(COMMITTEE.md §4.3)。
MVP 主线不接;接口先留空。**不改 contract**,反证塞进现有 `Tradeoff{conflict, resolution}`。

## 6. committee checkpoint(决定:MVP 跳过调用)

roadmap §8.7 列了 `risk.checkpoint("committee")`,#10 的 deterministic 也留了 committee stage(passthrough)。
**MVP 不主动调** —— #14 直接读已有信号即可;留作后续 audit 增强(调一次记录硬 gate 评估)。

## 7. 模块结构 + TDD 顺序

```
lib/agents/committee/
  weights.ts    ← 固定权重常量
  gates.ts      ← applyGates(o, ctx, brief): { decision, hits: GateHit[] }（纯函数,单测核心）
  merge.ts      ← mergeAndGate: 加权 overall + baseDecision + 合成 + 排序
  devil.ts      ← runDevil（P1,可降级,先 stub）
  index.ts      ← committeeAgent: Agent
  __tests__/
```

**TDD 顺序:** `gates.ts`(覆盖三候选边界)→ `merge.ts`(排序 + 封顶)→ `index.ts`(Agent 装配)→ Devil 留后。

## 8. 验收锚点(roadmap §8.7 + COMMITTEE.md)

- 吸尘器 = **Watch**,且 base 本应是 Go(gate 封顶才是 Watch)。
- `decision_reason` 同时提**利润敏感** + **合规/人工复核**。
- 高风险品(`risk_level==="high"` 或 `hard_block`)**不能 Go**。
- 排序尊重 gate:Go > Watch > Reject(mock:cable organizer > desk vacuum > dehumidifier)。
- dehumidifier 命中 Gate A/B → Reject;cable organizer 无 gate → Go。
- 最终 `RunResult` 过 `scripts/check-contract.mjs`。
