# COMMITTEE.md — Commerce Committee 规范

> 电商版"投委会"的实现规范。改编自一份金融多智能体投委会架构,核心思想保留、
> 业务规则换成电商。**任何实现 `lib/agents/committee.ts` 的 agent / 队员,先读这里。**
>
> 配套阅读:[AGENTS.md](AGENTS.md)(7 个 agent 总览)、[IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md)
> (7-agent 后端权威)、[ARCHITECTURE.md](ARCHITECTURE.md)(利润模型 + 权重)、`contract/`(唯一数据对齐目标)。

> ⚠️ **实现方向变更(2026-06,#14):** 本规范 §1「LLM 不碰最终决策 / 确定性 Gate 是硬保障」**已被推翻**。
> #14 落地为 **pure-A:LLM 直接定 Go/Watch/Reject(产品亮点)**;确定性加权/gate 降级为 **证据 + LLM 失败兜底**。
> **硬红线(hard_block / risk 高不能 Go)改由 skill 指令 + eval 保障(软约束),不再是代码硬闸**;demo 安全网仍是 `?mock=1`。
> **以 [docs/design/committee.md](design/committee.md) 为 #14 的实现权威**;本文的加权公式/权重/contract 映射仍有效,gate 部分仅作"兜底逻辑"参考。

---

## 0. 一句话

> Market / Sourcing / Margin / Risk / Listing / Packaging 六个 feeder agent 产出 **evidence + score + 判断**;
> Committee **不靠 LLM 拍板**——它用**确定性规则合并打分 + 封顶决策**,LLM 只负责
> **质疑(Devil's Advocate)和措辞(summary)**。

---

## 1. 设计哲学(从金融架构迁移过来的)

| 原则 | 在本项目的含义 |
|---|---|
| **LLM 不碰最终决策** | 合并打分、Go/Watch/Reject 全是确定性 TS,可复现、可审计 |
| **确定性 Gate 是硬保障** | 禁售/IP/履约/利润敏感等用纯函数封顶,LLM 翻不了车 |
| **制度性反对** | Devil's Advocate 是流程内强制环节,不是可选项 |
| **优雅降级** | 任一 LLM 调用失败 → fallback 安全默认,不阻断 demo |

**为什么这条对我们尤其重要(铁律 #3):** demo 高潮是
「base 28% 但悲观档掉到 12% → Committee 给 **Watch 不给 Go**」。
如果这步交给 LLM 判断,live demo 有概率某一跑就吐出 Go。
**做成确定性 gate(`margin.low < target_margin → 封顶 Watch`)→ 永远不翻车。**

---

## 2. Committee 内部分两层

```
五个 agent 的中间产物 + brief
        │
        ▼
┌─────────────────────────────────────────────┐
│  committee = mergeAndGate()  ← 确定性,不调模型 │
│    1. 加权合并 → overall score                 │
│    2. baseDecision  (score → Go/Watch/Reject) │
│    3. Commerce Gates (封顶 / 硬拦截)           │
│    4. 排序 ranked_ids                          │
├─────────────────────────────────────────────┤
│  runDevil() + writeSummary()  ← LLM,可选,无工具│
│    产出反证 → 灌进 tradeoffs[] + summary       │
└─────────────────────────────────────────────┘
        │
        ▼
  Committee + 每个 opportunity 的 decision/decision_reason
```

> **P0/MVP:** 第 1 层(确定性)必做,demo 主线全靠它。第 2 层 Devil 是 P1 加分,
> 失败可降级。两层都**不改 contract**(见 §6)。

---

## 3. 第一层 · 确定性合并 + Commerce Gates

### 3.1 加权合并

权重已在 contract 固定(`committee.weights`,见
[ARCHITECTURE.md](ARCHITECTURE.md#committee-决策)):

```
overall = profit*0.30 + demand*0.25 + compliance*0.20
        + fulfillment*0.15 + packaging*0.10        // 各分量 0..100
```

写回 `opportunity.scores.overall`。

### 3.2 baseDecision(仅看分数)

```
overall >= 70  → Go
overall >= 50  → Watch
else           → Reject
```

> baseDecision 只是起点,**真正的决策由 §3.3 的 gate 封顶**。

### 3.3 Commerce Gatekeeper(确定性规则,纯函数)

这是金融架构 "Risk Controller" 的电商版。**所有输入字段 contract 里都已存在,
零 schema 改动。** 两类 gate:

**A. 硬拦截 → 直接 `Reject`**(覆盖一切)

| 触发条件 | 数据来源 |
|---|---|
| 禁售 / 限售品类 | risk agent flags(读 `seed/` 禁售规则) |
| 品牌 / IP 侵权 | risk agent flags |
| 图文不符被判违规 | `selected_listing.images[].compliance === "rejected"` |
| 根本没有可行履约路径 | sourcing 中间产物:无可用供应商 / 履约远超上限 |

**B. 封顶到 `Watch`**(最多 Watch,**禁止 Go**;可与 A 共存,A 优先)

| 触发条件 | 数据来源 | 备注 |
|---|---|---|
| 悲观档利润低于目标 | `margin.low.net_margin < brief.target_margin` | **← demo 高潮,务必做实** |
| 履约超平台上限 | `fulfillment_days > brief.max_fulfillment_days` | sourcing 中间产物 |
| 关键字段缺失,listing 未 ready | `selected_listing.shopee.missing_fields.length > 0` | |
| 需人工复核 | `selected_listing.compliance.human_review_required === true` | 电器安全/认证 → 不 Go |
| 风险等级高(非硬违规) | risk agent `risk_level === "high"` | |
| 数据置信度低 | 关键 agent `confidence` 偏低 | 金融"波动率缩放"的电商版,**只要一个 cap,别搬 Kelly/vol scaling** |

> **命名陷阱:** contract 里 `margin.low` = **悲观档(高退货率/高运费场景)**,
> `margin.high` = 乐观档。demo 说的"high-return 档掉到 12%"指的是 `margin.low`,**不是** `margin.high`。

### 3.4 决策合成(确定性)

```
decision = baseDecision
if (任一 A 类 gate)  decision = "Reject"          // 硬拦截优先
else if (任一 B 类 gate) decision = min(decision, "Watch")   // 严重度: Go > Watch > Reject,封顶不能升
```

把触发的 gate 列表留存,喂给 §4 写进 `decision_reason` / `tradeoffs` / `summary`。

### 3.5 排序

`ranked_ids`:Go 优先于 Watch 优先于 Reject;同档按 `overall` 降序。

---

## 4. 第二层 · Devil's Advocate(LLM,无工具,可降级)

### 4.1 角色

只看前 5 个 agent 的摘要,**强制产出 ≥3 条具体、可证伪的反证**。不给工具
(职责是批判性推理,不是再采一遍数据;单次调用 ~2s)。

**反证维度(电商版,替换金融的宏观/估值等):**

- 需求是不是**假热度**?(榜单刷量 / 季节性 / 一次性流量)
- 竞品是否**已价格打穿**?毛利空间是不是已被卷没?
- 1688 报价是否**低估运费 / MOQ / 损耗 / 退货**?
- Shopee listing 是否有**夸大、图文不符、认证暗示**?
- **售后 / 退货**是否会吃掉利润?

### 4.2 输出落地(MVP 不改 contract)

铁律 #1:改 contract = 改 3 文件 + 通知全队。MVP 别为反证停一次。
**复用现有 `Tradeoff = {opportunity_id, conflict, resolution}` 结构装反证:**

```
conflict   = 魔鬼提出的反证(如"1688 报价未含 SG 海运 + 5% 损耗")
resolution = committee 如何处理(如"已按悲观档封顶 Watch / 已在 listing 去夸大词 / 暂无法证伪")
```

`summary` 用一段 LLM 文案综述决策与主要反证。
> 过了 MVP 再考虑加 `hard_gates_applied / counterpoints / decision_caps` 独立字段
> (届时走"改 3 文件 + 通知全队"流程)。

### 4.3 降级

Devil 调用失败 → `tradeoffs` 退化为确定性 gate 生成的条目,`summary` 用模板拼接。
**流程不中断**——确定性层已给出完整决策。

---

## 5. 不要从金融架构搬过来的东西

| 金融机制 | 为什么不搬 |
|---|---|
| Kelly 公式 / 仓位权重 | 我们决策是离散 Go/Watch/Reject,不是连续仓位 |
| 波动率缩放(vol scaling) | 电商对应物就是"低置信度 → 封顶 Watch",一个 cap 足够 |
| `scores ∈ [-1,1]` 多维再压均值 | 我们的 `OpportunityScores`(0–100,领域化分量)已更好,别降级 |

---

## 6. 输出 → contract 字段映射(必须通过 `result.schema.json`)

| committee 产物 | contract 字段 |
|---|---|
| 加权 overall | `opportunities[].scores.overall` |
| 最终决策 | `opportunities[].decision` (`Go`/`Watch`/`Reject`) |
| 决策理由(含触发的 gate) | `opportunities[].decision_reason` + `key_reasons[]` |
| 排序 | `committee.ranked_ids` |
| 权重(固定) | `committee.weights` |
| 反证 / 冲突 | `committee.tradeoffs[]`(见 §4.2) |
| 综述 | `committee.summary` |
| 人工复核标记 | `selected_listing.compliance.human_review_required` |

> 用 `scripts/check-contract.mjs` 校验最终 `RunResult`。

---

## 7. 实现签名参考(TS)

```ts
// ── 确定性:合并 + 封顶,纯函数,不调模型、无 IO ──
function mergeAndGate(
  agentOutputs: AgentOutputs,   // 5 个 agent 的中间产物 + brief
): {
  opportunities: Opportunity[]; // 已写好 decision / scores.overall / key_reasons
  committee: Omit<Committee, "tradeoffs" | "summary"> & { gates: GateHit[] };
};

// ── 单个机会的 gate 判定(可单测,覆盖边界 case)──
function applyGates(opp: OpportunityDraft, brief: Brief): {
  decision: Decision;
  hits: GateHit[];
};

// ── LLM:反证,失败返回确定性 fallback ──
async function runDevil(
  summaries: string[], minCounterpoints = 3,
): Promise<Tradeoff[]>;
```

**实现顺序:** 先 `mergeAndGate` + `applyGates`(确定性,带单测覆盖 demo 高潮的
吸尘器 case)→ 跑通 mock 主线 → 再接 `runDevil`。
**任何时候 `/api/run` 输出都要能通过 `contract/result.schema.json`。**
