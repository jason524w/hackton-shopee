# TASK-BE · 后端 agent 管道 + /api/run(独立轨,P1 拥有)

> `lib/agents/*` 是纯 TS 模块,**可立刻对着 contract 开写,不等骨架**;
> 只有 `app/api/run` 接线需要 TASK-01 落地。内部用 **6 路 subagent 扇出**(一 agent 一文件)。

## 独占路径
`lib/agents/**` `app/api/run/**` `lib/cost-model.ts`

## 公共约定
- 每个 agent = 一次 Responses API 调用,`response_format` 用 strict `json_schema`,
  输出直接是 `contract/result.ts` 对应结构。
- prompt 强约束:**只基于传入数据/工具结果判断,不凭记忆编造**。
- Market/Sourcing 用 Function Calling 读 `seed/`(依赖 TASK-DATA,没数据时先用 mock 兜)。
- **任何时候 `/api/run` 整体输出必须通过 `contract/result.schema.json`。**

## Subagent 扇出(各写各文件,详规见 docs/AGENTS.md)

- □ `lib/agents/market.ts` — 产 3 候选 + demand 信号(Function: search_shopee)
- □ `lib/agents/sourcing.ts` — primary 候选货源(Function: get_1688_quotes)
- □ `lib/agents/margin.ts` — **护城河**:利润公式 low/base/high + cost 瀑布(用 `lib/cost-model.ts`)
- □ `lib/agents/risk.ts` — **护城河**:对照 Shopee 规则打分;**吸尘器必须出「夸大吸力/电器安全」warning**
- □ `lib/agents/listing.ts` — Shopee 字段 + 本地化标题/卖点/图 prompt
- □ `lib/agents/committee.ts` — 汇总 + tradeoff + Go/Watch/Reject 排序(权重 30/25/20/15/10)
- □ `app/api/run/route.ts` — 串联管道;`?mock=1` 直回 mock;真实模式跑全链

## 实现顺序
1. 先用 mock 片段把整条管道**接线跑通**(每个 agent 先返回 mock 子结构)。
2. 逐个 agent 换成真实 OpenAI 调用,先做 margin / risk(护城河)。
3. 跑通后把一次真实输出**存成缓存 JSON**,demo 走缓存。

## 验收
- `/api/run`(非 mock)真实跑出结果,**通过 `result.schema.json` 校验**。
- 吸尘器 primary:决策 = **Watch**,Risk 含电器/夸大 warning,利润卡 base≈28%、high-return 档≈12%。
- 前端把 mock import 换成 `fetch('/api/run')` 后,**零改动**正常渲染。
