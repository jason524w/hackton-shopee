# TASK-10 设计 · Margin + Risk(护城河)

> [#10](https://github.com/jason524w/hackton-shopee/issues/10) 的实现设计。先读 [COMMITTEE.md](../COMMITTEE.md)(消费这里的产物做 gate)、
> [ROADMAP §7/§8.3/§8.4](../IMPLEMENTATION-ROADMAP.md)、[AGENTS.md](../AGENTS.md)。
> **本文是 #10 的对齐目标;数字是反解出来的,可调,但要保持三条 harness 目标 + 瀑布自洽。**

## 0. 这个 issue 的本质:两块,形态不同

| | Margin | Risk |
|---|---|---|
| 形态 | 普通顺序 agent | **跨切 supervisor**(非顺序) |
| 核心 | 纯函数成本瀑布 | 4 个 stage 的 checkpoint + 末尾聚合成 1 个 `AgentResult` |
| LLM | 只解释敏感性,**不算钱** | 只补叙述,**不定 gate / 不漏硬违规** |
| 被谁调 | pipeline 顺序调 | `risk.checkpoint(stage)` 被 margin/listing/packaging/committee 各自回调 |

## 1. Demo 高潮的确定性链条(必须钉死)

```
margin.calculator → margin.low.net_margin ≈ 0.126   ← 悲观档(高退货 + 运费/FX 恶化)
                              ↓ 0.126 < brief.target_margin (0.25)
risk.checkpoint("margin") → warning「利润对退货/运费敏感,建议封顶 Watch」
risk 聚合 → risk_level=medium, human_review_required=true(电器 + 夸大吸力)
                              ↓ 写进 contract
committee(#14) 确定性 gate 读 margin.low + human_review → 封顶 Watch(不给 Go)
```

- **#10 不做封顶决策**(那是 #14),但**必须产出 gate 要读的两个值**:`margin.low.net_margin` 和 `risk.human_review_required`。
- **命名陷阱:** `margin.low` = **悲观档(高退货/高运费)**,`margin.high` = 乐观档。demo 说的"high-return 档掉到 12%"指的是 **`margin.low`**。

## 2. 锁定的决策

| # | 决策 | 选择 |
|---|---|---|
| Q1 | listing/packaging checkpoint 规则归属 | **#10 全包**:全部 stage 规则在 `lib/agents/risk/`,#12/#13 只组 payload + 调用(风险逻辑一处、可审计、一个 risk_level 聚合) |
| Q2 | `minimum_viable_price` 定义 | **达标价**:解 `net_margin == brief.target_margin` 时的售价 |
| Q3 | low/base/high 驱动 | **退货率 + 国际运费 + FX 波动带**:base 点估计,low 三者同时恶化,high 反向 |

---

## 3. Margin 设计

### 3.1 成本公式(代码算钱,LLM 不算)

```txt
net_profit = selling_price
           − source_price            (FX 换算后)
           − intl_shipping
           − local_delivery
           − import_gst              (= 9% × CIF = 9% × (source + intl_shipping))
           − platform_fee            (= 8%  × selling_price)
           − payment_fee             (= 2%  × selling_price)
           − return_reserve          (= r%  × selling_price)
           − damage_reserve          (= d%  × selling_price)
           − packaging
           − ai_ops
net_margin = net_profit / selling_price
```

> **GST 建模决定:** 目标用户是轻资产个人卖家(`seller_type=individual_dropshipper`),多半**未注册 GST**,
> 不向买家收销项 GST。真正的 GST 成本是 **进口 GST**(SG 自 2023 对低价进口商品征 9%),按 CIF(货值+国际运费)计。
> 这也解释了 mock 里那条 ~0.40 的 GST(≈ 9%×4.40)。**不要**把 GST 当售价的 9%(那是销项,卖家不承担)。

### 3.2 假设表(base + 三档波动带)

固定项(SGD/件)与百分比项,base 为点估计;low/high 只动 **退货率 / 国际运费 / FX** 三个驱动:

| 驱动 | base | low(悲观) | high(乐观) |
|---|---|---|---|
| FX CNY→SGD | 0.184 | 0.205 (+11%) | 0.168 (−9%) |
| → source_price (1688 ¥15.8) | 2.90 | 3.23 | 2.65 |
| intl_shipping | 1.50 | 1.90 | 1.30 |
| return_reserve | 5% | 13% | 2% |
| damage_reserve | 2% | 4% | 1% |
| **固定不动** | local 1.20 · packaging 0.30 · ai_ops 0.10 · platform 8% · payment 2% | | |

### 3.3 反解结果(售价 = 11.90,target_margin = 0.25)

| 档 | net_profit | net_margin | harness 目标 | 说明 |
|---|---|---|---|---|
| **base** | ≈ 3.48 | **≈ 29%** | ≈28% ✅(容差内) | 清过 25% 目标 |
| **low** | ≈ 1.50 | **≈ 12.6%** | ≈12% ✅ | **< target 0.25 → 触发 Watch 封顶** |
| **high** | ≈ 4.45 | **≈ 37%** | ≈38% ✅ | 乐观 |

- `minimum_viable_price`(达标价)= 解 base 假设下 `net_margin == 0.25` → **≈ 11.03**;suggested 11.90 > 11.03,故市场价能达标,但悲观档失守 → 故事成立。
- `cost_breakdown` 由计算器逐行产出,**求和 == net_profit(容差内)** 由构造保证,不抄 mock。
- `selling_price` / `source_price` 等是上游(market/sourcing)输入;开发期从 `contract/mock-result.json` fixture 取。

### 3.4 目录

```
lib/agents/margin/
  assumptions.ts   ← 上表(point + 三档波动带),文档化常量
  calculator.ts    ← 纯函数 (assumptions, selling_price) => MarginDetail
  skill.ts         ← LLM 仅产敏感性叙述(可降级,失败用模板)
  index.ts         ← Agent: 读上游切片 → calculator → risk.checkpoint("margin")
  __tests__/
```

---

## 4. Risk 设计:三段式(借鉴姊妹项目 UpUp)

`确定性预检` + `LLM 模糊判断` + `合并取并集` —— 对应 UpUp 的
`deterministic_preflight` + `run_risk_review` + `merge_risk_results`。

```
lib/agents/risk/
  checkpoints.ts    ← runRiskCheckpoint(stage, payload, ctx) 分发到各 stage 规则集
  deterministic.ts  ← 确定性预检(纯函数,CI 可跑)
  claims.ts         ← 夸大词黑名单匹配(listing 文本 + packaging prompt 共用)
  llm-review.ts     ← LLM 处理模糊地带(夸大/图文不符),可降级
  merge.ts          ← 取并集
  aggregate.ts      ← 全部 checkpoint → 1 个 Risk AgentResult(risk_level/human_review/warnings)
  index.ts
  __tests__/
```

### 4.1 demo 红线(比 UpUp 更严)

**demo 高潮的两个信号必须在 `deterministic.ts`,不依赖 LLM:**
- "super suction / 超强吸力 / industrial / 工业级" 命中 → 确定性
- 电器类目(`home_appliances_small`)→ `human_review_required = true` → 确定性

LLM(`llm-review.ts`)只**追加** soft 发现;它挂了,确定性层仍单独产出 `risk_level=medium / human_review=true`。
**取并集 → 确定性兜底,LLM 是 gravy,live 翻车也不掉 demo。**
`seed/shopee/policy-rules-sg.json` 里 `severity:"hard_block"` → 确定性层;`severity:"warning"` 语义类 → LLM 层。

### 4.2 四个 checkpoint stage(listing vs packaging 的区别)

| stage | 谁调 | payload | 查什么 |
|---|---|---|---|
| `margin` | Margin(#10) | margin 计算结果 | 退货/损耗敏感、悲观档 < target、夸大利润 → 是否建议封顶 Watch |
| `listing` | Listing(#12) | 生成的 **Shopee 文字**(标题/描述/bullet/属性/类目) | 禁售/限售、电器安全标注、**类目属性不匹配**、**文案夸大词**、关键词堆砌 |
| `packaging` | Packaging(#13) | 图像 **prompt + 生成图** | prompt 只用真实规格、不夸大吸力、**图无不存在的功能**、**不暗示安全认证**、卖点标注与规格一致 |
| `committee` | Committee(#14) | 候选 + 各 agent 产物 | 硬 gate、最终人工复核、确保高风险不能 Go |

> 一句话:**listing 管"写了什么字",packaging 管"画了什么图"**。同一套"不许夸大/不许暗示认证"的精神,载体不同(文本 vs prompt+像素)。

### 4.3 MVP 必达产出(吸尘器)

`risk_level=medium` · `human_review_required=true` · warning「避免夸大吸力」· warning「USB/电器安全需复核」· **无硬禁售**(除非有真实 rule 快照支持)。

---

## 5. Harness 断言(各 agent 自带 `__tests__`)

- base net margin ≈ 28%、悲观档 ≈ 12%(容差内)
- `cost_breakdown` 求和 == net_profit(容差内);每行有 label/amount/type
- `minimum_viable_price` = 达标价(base 假设下 margin==target)
- margin checkpoint 跑过并对敏感性记 warning
- 吸尘器 risk:medium / human_review=true / 两条 warning;夸大词命中走确定性层(LLM mock 关掉也成立)

## 5.5 下游 checkpoint 约定(#12/#13/#15 必读)

#10 实现了 `createRiskSupervisor()`(`lib/agents/risk`)+ 全部 stage 的确定性规则。
下游**不需要写任何风险逻辑**,只要按下面的约定调用 / 注入。接口本体是 #23 的 `lib/agents/contracts.ts`。

### #15 API 注入(否则风险引擎不生效)

```ts
import { createRiskSupervisor, riskAgent } from "@/lib/agents/risk";
import { marginAgent } from "@/lib/agents/margin";

const ctx: AgentContext = { brief, results, providers, risk: createRiskSupervisor() };
// pipeline 顺序:market → sourcing → margin → listing → packaging → committee → risk(末位聚合)
await runPipeline([market, sourcing, marginAgent, listing, packaging, committee, riskAgent], ctx);
```

- `riskAgent` 必须排在**最后**:它读 `ctx.risk.getCheckpoints()` 聚合,不重新扫描。
- 可选:`createRiskSupervisor({ llmReviewer })` 接 LLM 模糊判断;不传 = 纯确定性(demo 安全网)。

### #12 Listing → `await ctx.risk.checkpoint("listing", payload)`

| payload 字段 | 类型 | 规则读它做什么 |
|---|---|---|
| `title` / `description` | string | 扫夸大词(super suction / industrial-grade / certified…)|
| `bullet_points` | string[] | 同上 |
| `category` | string | 含 `home_appliances_small`/`usb`/`cordless` → `human_review_required=true` |
| `brand` | string | 命中受保护品牌(dyson/xiaomi…)→ `hard_block=true` |

返回的 `RiskCheckpoint.{warnings, human_review_required, hard_block}` 回填到
`selected_listing.compliance`(human_review / warnings)。

### #13 Packaging → `await ctx.risk.checkpoint("packaging", payload)`

| payload 字段 | 类型 | 规则读它做什么 |
|---|---|---|
| `prompt` | string | 扫图像 prompt 的夸大词(不暗示安全认证、不画不存在的功能)|
| `category` | string | 电器 → `human_review_required=true` |

`checkpoint()` 是 **async**,记得 `await`;每次调用都会被 supervisor 记录,最后由 `riskAgent` 聚合进 Risk `AgentResult`。

## 6. 状态与依赖

- ✅ [#23 接缝](https://github.com/jason524w/hackton-shopee/issues/23) 已合(`lib/agents/contracts.ts`);#10 已对真接口接线(PR #28)。
- #10 产物:`margin/{calculator,assumptions,index}.ts`、`risk/{claims,deterministic,merge,checkpoints,aggregate,index}.ts`,18 vitest 全绿。
- 下游:#15 注入 supervisor、#12/#13 按 §5.5 调 checkpoint;committee(#14)读 `margin.low` + `human_review`/`hard_block` 封顶。

## 7. 开源参考(验证科目/区间,无可直接 vendor 的代码)

- Margin 公式与科目:[VimalBharti/Ecommerce-Profit-Margin-Calculator](https://github.com/VimalBharti/Ecommerce-Profit-Margin-Calculator)、[Inconite/Product-Profit-Margin-Calculator](https://github.com/Inconite/Product-Profit-Margin-Calculator)
- Shopee 分类目费率:[V3 Shopee Fees & Profit Calculator](https://mohamadafiza.github.io/calculator/shopee)
- "true profit" 必含退货/支付/履约:[trueprofit](https://trueprofit.io/profit-margin-calculator)、[dropship.io](https://www.dropship.io/numbers-breakdown)
- 跨境到岸成本(FX 2-8% / 关税 5-25% → 波动带取值):[Klavena landed cost guide](https://www.klavena.com/blog/the-complete-guide-to-landed-cost-calculation-for-ecommerce/)
- 夸大宣传/合规黑名单词(`certified/official/FDA/100% genuine`):[Amazon 合规](https://gobrandwoven.com/resources/articles/amazon-compliance-restricted-products-claims-keywords/)、[Logic 商品审核](https://logic.inc/workflows/moderate-product-listing-for-policy-compliance)

> **差异点(写进 pitch):** 这些工具都只**算一个数**;我们**算完做 profit-aware 的离散决策(封顶 Watch)**。没有开源做这件事 —— 这就是护城河,别被"又一个利润计算器"的叙事淹没。
