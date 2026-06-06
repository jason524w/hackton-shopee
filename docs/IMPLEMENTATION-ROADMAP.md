# Sea Launch AI Unified Implementation Roadmap

> 本文件是 24h MVP 的统一实施路线图和团队协作 TODO list。
> 它基于当前 `main` 分支 tracked files 整理而来,用于消除 6-agent 旧文档、7-agent 新方案、contract 现状之间的冲突。

## 0. 本文件的权威性

当本文件与旧文档冲突时,按下面顺序处理:

1. `contract/` 当前文件是前后端运行时的硬契约。任何代码输出必须先通过它。
2. 本文件定义下一步要落地的目标契约、目录、agent 拆分、tool、harness 和任务拆分。
3. 旧文档里所有 "6 个 agent"、"Listing Agent 负责图片"、"图片只预生成"、"真实链路只是加分项" 的说法,都按本文件修正。

重要结论:

- MVP 产品只做 `Mini Desk Vacuum · Shopee Singapore`。
- UI 和 listing 输出语言用 English。
- 前端可以直接使用 shadcn/Tailwind dashboard 模板和 Recharts,不用在本文件里重新设计。
- Hackathon 现场要能 live 调 OpenAI 跑真实 agent 管道。
- 图片由 Packaging Agent 现场生成。预生成图片只作为兜底 fallback。
- `/api/run?mock=1` 必须永远可用,这是 demo 安全网,不是替代真实链路。

## 1. Main 分支文档清理结论

当前 `main` 的人读主文档只保留三份:

| 文件/目录 | 当前作用 | 需要统一的点 |
| --- | --- | --- |
| `README.md` | 项目介绍、MVP 故事、三份主文档入口 | 不放详细任务和重复架构 |
| `docs/IMPLEMENTATION-ROADMAP.md` | 唯一完整 roadmap:架构、contract 计划、agent skill/tool/harness、audit、DoD | 本文件是所有实现细节的来源 |
| `docs/TASKS.md` | 团队执行任务板和 PR-sized TODO list | 只列任务、路径、验收,细节回链本文件 |

非文档但仍保留的实现/协作文件:

| 文件/目录 | 作用 |
| --- | --- |
| `contract/result.ts` | 前后端 TypeScript 数据契约 |
| `contract/result.schema.json` | `/api/run` 输出校验目标 |
| `contract/mock-result.json` | 前端 mock 和 demo 兜底 |
| `scripts/check-contract.mjs` | 零依赖 contract check |
| `.github/workflows/contract-check.yml` | PR contract CI |
| `.env.example`, `.gitignore` | 工程配置 |

已合并到本文件并删除的重复文档:

- `CLAUDE.md`
- `CONTRIBUTING.md`
- `contract/README.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/AGENTS.md`
- `docs/COMMITTEE.md`
- `docs/MVP-SCOPE.md`
- `docs/shopee-1688-api-docs.md`
- `docs/tasks/*.md`

结论:从现在开始,团队只读 README、Roadmap、Tasks。所有新信息都进入这三份之一,不要再新增平行 PRD、architecture、agent spec 或子任务文档。

## 2. MVP 最终范围

### 2.1 做什么

只做一条完整主线:

```txt
Seller Brief
  -> Agent War Room
  -> Opportunity Board
  -> Listing Studio
  -> ROI / Admin Summary
```

输入固定主商品方向:

```txt
Product: Mini Desk Vacuum
Market: Singapore
Platform: Shopee
Seller type: individual dropshipper / small seller
Language: English
Risk appetite: balanced
Target margin: 30%
```

系统必须现场产出:

- Shopee SG 市场信号判断。
- 货源、库存、MOQ、包装重量和跨境履约估算。
- low/base/high 三档利润模型。
- Risk Agent 明确提示:
  - exaggerated suction claim warning
  - electrical safety / USB power human review warning
- Shopee-ready listing package。
- Packaging Agent 生成英文本地化包装角度、商品图 prompts 和 live image candidates。
- Committee Agent 给 `Watch`,不能给 `Go`。

### 2.2 不做什么

MVP 不做:

- 多市场配置的完整生产化。
- Shopee OAuth、真实上架写回、订单管理。
- 完整供应商聊天和自动采购。
- 用户账户、团队权限、账单系统。
- 复杂长期监控任务。
- LangChain/CrewAI 等重编排框架。

### 2.3 Demo 的核心高潮

Demo 判断标准仍然是:

```txt
Mini Desk Vacuum
  -> Risk Agent 点亮 "exaggerated suction / electrical safety review"
  -> Margin Agent 显示 base net margin around 28%, bad case around 12%
  -> Committee Agent 给 Watch,解释为什么不直接 Go
```

这条故事必须稳定。任何 feature 如果不服务这条故事,就放进 backlog。

## 3. 最终 Agent 拆分

### 3.1 Contract AgentKey 目标

目标 `AgentKey` 必须从 6 个变成 7 个:

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

必须同步修改:

- `contract/result.ts`
- `contract/result.schema.json`
- `contract/mock-result.json`

同时新增:

- `RunResult.audit_run_id`
- `GET /api/runs/:id/audit`

注意:

- `selected_listing.images[]` 仍然是最终 UI 渲染入口,但产物来源改为 Packaging Agent。
- Listing Agent 只负责 Shopee 字段结构、标题、描述、SKU、属性和 logistics。
- Packaging Agent 负责图片 prompt、生成图、平台风格和图片合规 notes。

### 3.2 Runtime 执行图

用户确认的执行顺序为:

```txt
market -> sourcing -> margin -> listing -> packaging -> committee
```

Risk Agent 是独立 agent,但不是单纯线性步骤。它作为风控监督者在关键节点被调用:

```txt
market
  -> sourcing
  -> margin
       -> risk.checkpoint("margin")
  -> listing
       -> risk.checkpoint("listing")
  -> packaging
       -> risk.checkpoint("packaging")
  -> committee
       -> risk.checkpoint("committee")
```

War Room 要显示 7 个 agent:

- `market`
- `sourcing`
- `margin`
- `risk`
- `listing`
- `packaging`
- `committee`

其中 `risk` 卡片展示 accumulated checkpoints,而不是只显示一次线性输出。

### 3.3 每个 agent 的标准结构

每个 agent 都必须是独立模块:

```txt
lib/agents/<agent-key>/
  skill.ts        # role, policies, scoring rules, output contract
  schema.ts       # input/output zod schema and JSON schema export
  tools.ts        # agent-specific tool bindings
  harness.ts      # fixture replay, assertions, golden tests
  index.ts        # run<AgentName>Agent()
```

每个 agent 必须满足:

- 有自己的 skill 定义。
- 有自己的工具清单。
- 有输入 schema 和输出 schema。
- 有 harness,可用 fixture replay。
- 有 audit trail,记录 tool calls、model response id、parsed JSON、schema validation、latency、cost。
- 内部执行采用 ReAct-style loop:模型可观察工具结果,决定下一步 tool call,最后输出 strict JSON。

## 4. 推荐目录结构

目标结构:

```txt
app/
  api/
    run/
      route.ts
    runs/
      [id]/
        audit/
          route.ts

contract/
  README.md
  mock-result.json
  result.schema.json
  result.ts

lib/
  openai.ts
  agent-runtime/
    run-agent.ts
    tool-runner.ts
    audit.ts
    schemas.ts
    errors.ts
    replay.ts
    cost.ts
    ids.ts
  providers/
    shopee/
      index.ts
      fixtures.ts
      types.ts
    sourcing-1688/
      index.ts
      fixtures.ts
      types.ts
    shipping/
      index.ts
      rates.ts
      types.ts
    fx/
      index.ts
      rates.ts
      types.ts
    openai-image/
      index.ts
      prompts.ts
      compliance.ts
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
  shopee/
    mini-desk-vacuum-search.json
    mini-desk-vacuum-category.json
    policy-rules-sg.json
  sourcing-1688/
    mini-desk-vacuum-offers.json
  shipping/
    cn-to-sg-rates.json
  fx/
    cny-sgd.json
  images/
    fallback-desk-vacuum-hero.png
    fallback-desk-vacuum-lifestyle.png
    fallback-desk-vacuum-feature.png

public/
  generated/
    <audit_run_id>/
      hero.png
      lifestyle.png
      feature.png

.runs/
  <audit_run_id>/
    manifest.json
    agents/
      market.json
      sourcing.json
      margin.json
      risk.json
      listing.json
      packaging.json
      committee.json
    tools/
      *.json
```

`.runs/` 是本地开发和 demo audit 存储。部署环境如果不能写磁盘,先降级到 memory audit 或 Vercel Blob/Postgres 之后再接。

## 5. Agent Runtime 要求

### 5.1 `run-agent.ts`

职责:

- 封装 OpenAI Responses API。
- 接收 agent skill、input schema、output schema、tools、runtime mode。
- 强制 Structured Outputs。
- 驱动 tool call loop。
- 做 retry 和 timeout。
- 返回 parsed JSON 和 audit metadata。

最低接口:

```ts
type RunAgentOptions<Input, Output> = {
  agentKey: AgentKey;
  skill: AgentSkill;
  input: Input;
  outputSchema: JsonSchema;
  tools: AgentTool[];
  auditRunId: string;
  mode: "mock" | "fixture" | "live";
  maxToolIterations?: number;
};
```

### 5.2 `tool-runner.ts`

职责:

- 注册 provider tools。
- 校验 tool input。
- 调用 adapter。
- 标准化 tool output。
- 把每次 tool call 写入 audit。

禁止:

- agent 直接调用 Shopee/1688/OpenAI Image 原始 API。
- tool output 直接把 secret、cookie、完整用户隐私写进 audit。

### 5.3 `audit.ts`

每次 `/api/run` 必须记录:

- `audit_run_id`
- request brief snapshot
- agent key and skill version
- input snapshot
- tool calls
- normalized tool output
- OpenAI model
- model response id
- parsed JSON output
- schema validation result
- latency
- estimated token/image cost
- warnings and errors

不要记录:

- OpenAI hidden reasoning。
- API key。
- Shopee/1688 登录态。
- 用户未授权的原始隐私数据。

### 5.4 `replay.ts`

职责:

- 从 `.runs/<audit_run_id>` 复现一次 agent 管道。
- 支持只 replay provider fixtures。
- 支持只 replay某个 agent 的 input/output。
- 为现场 debug 提供证据。

### 5.5 Runtime modes

```txt
mock      -> /api/run?mock=1,直接返回 contract/mock-result.json
fixture   -> 读 seed fixtures,可 live 调 OpenAI text,可 images=0
live      -> live OpenAI text + live OpenAI image,provider 若无 API key 则 fixture fallback
```

Hackathon 演示建议:

1. 先打开 mock,证明 UI 主线稳定。
2. 切 live text,展示 agent 真的调用 OpenAI。
3. 切 live image,展示 Packaging Agent 现场生成商品图。
4. 如果 live image 超时,展示 fallback image + audit 里的失败记录,不能白屏。

## 6. Provider Tools

Provider adapter 是工具边界。agent 只调用工具,不接触原始平台 SDK。

### 6.1 Shopee provider

工具:

```ts
shopee.searchProducts(query, market, category)
shopee.getProductDetail(itemId)
shopee.getCategoryAttributes(categoryId)
shopee.getPolicyRules(market)
```

MVP 数据模式:

- 默认读取 `seed/shopee/*.json`。
- 将来拿到 Shopee API 后,只改 provider adapter。

输出必须包含:

- product title
- price
- rating
- review count
- sales/ranking label if available
- shop type if available
- image style notes if available
- source URL or fixture id
- captured_at

### 6.2 Sourcing provider

工具:

```ts
sourcing.searchOffers(query)
sourcing.getOfferDetail(offerId)
```

MVP 数据模式:

- 默认读取 `seed/sourcing-1688/*.json`。
- 将来可接 1688、Pinduoduo 或用户上传供应商资料。

输出必须包含:

- source price
- currency
- supplier candidates
- stock
- MOQ
- origin location
- domestic dispatch time
- package weight
- package dimensions
- supplier risk notes
- source URL or fixture id

### 6.3 Shipping provider

工具:

```ts
shipping.estimateCrossBorder(weight, dimensions, from, to)
```

输出必须包含:

- low/base/high shipping estimate
- shipping method
- lead time range
- assumptions
- warnings

### 6.4 FX provider

工具:

```ts
fx.convert(amount, from, to)
```

输出必须包含:

- converted amount
- rate
- rate source
- captured_at

MVP 可以先用 seed 固定汇率,但 audit 必须记录假设。

### 6.5 OpenAI Image provider

工具:

```ts
openaiImage.generateProductImage(prompt, constraints)
openaiImage.editProductImage(sourceImage, prompt)
openaiImage.checkImageCompliance(imageUrl, rules)
```

要求:

- live mode 调 OpenAI 图片生成。
- dry-run mode 只产出 prompts,不调图像 API。
- 生成图保存到 `public/generated/<audit_run_id>/`。
- 返回 image URL、prompt、model、response id、seed metadata、compliance notes。
- 失败时返回 fallback image URL 和 `needs_review` compliance,不能中断整条 demo。

## 7. Agent 详细规格

### 7.1 Market Trend Agent

#### Skill

角色:预测部 / 市场趋势分析师。

目标:判断 `Mini Desk Vacuum` 在 Shopee Singapore 是否有真实需求信号。

核心问题:

- 是否有人在买或至少有足够搜索/评论/竞品信号?
- 价格带在哪里?
- 竞品标题、图片和卖点有哪些重复模式?
- 市场热度是否足够支撑一个小卖家测试?

不能做:

- 不能编造真实销量。
- 不能把评论数当作真实月销量承诺。
- 不能没有 evidence 就给高 demand score。

#### Tools

- `shopee.searchProducts(query, market, category)`
- `shopee.getProductDetail(itemId)`
- 可选: `shopee.getCategoryAttributes(categoryId)`

#### Input

- seller brief
- product keyword: `mini desk vacuum`
- market: `Singapore`
- platform: `Shopee`
- category hint

#### Output

- `demand_signal_score`
- `competitor_count`
- `price_band`
- `review_density`
- `rating_distribution`
- `trend_source_links`
- top competitor snapshots
- image style notes for Packaging Agent
- confidence
- warnings

#### Harness

fixture:

```txt
seed/shopee/mini-desk-vacuum-search.json
```

assertions:

- `competitor_count > 0`
- `price_band.low > 0`
- `price_band.high >= price_band.low`
- every evidence item has `source` or `fixture_id`
- output never says "monthly sales are X" unless a real source explicitly provides it
- Mini Desk Vacuum demand is not `high confidence Go`; it should stay evidence-aware

#### Audit

必须记录:

- query
- market
- category hint
- top competitor ids
- tool snapshots
- demand scoring explanation

### 7.2 Sourcing Agent

#### Skill

角色:客户服务部 / 供应商对接与履约分析师。

目标:找到可以低价采购、库存足、履约可解释的货源。

核心问题:

- 货源价是否低于目标售价空间?
- MOQ 是否适合个人卖家测试?
- 库存和发货地是否合理?
- 包装重量/尺寸是否足以估算跨境物流?
- 履约周期是否超过用户上限?

#### Tools

- `sourcing.searchOffers(query)`
- `sourcing.getOfferDetail(offerId)`
- `fx.convert(amount, from, to)`
- `shipping.estimateCrossBorder(weight, dimensions, from, to)`

#### Input

- market agent output
- seller brief
- product requirements

#### Output

- `source_price`
- `source_currency`
- `source_price_sgd`
- `supplier_candidates`
- `available_stock`
- `min_order_quantity`
- `estimated_domestic_shipping_time`
- `package_weight`
- `package_dimensions`
- `cross_border_shipping_estimate`
- `fulfillment_days`
- sourcing risk warnings
- confidence

#### Harness

fixture:

```txt
seed/sourcing-1688/mini-desk-vacuum-offers.json
seed/shipping/cn-to-sg-rates.json
seed/fx/cny-sgd.json
```

assertions:

- `source_price > 0`
- MOQ is present
- stock is present
- package weight is present
- package dimensions are present
- if fulfillment days exceed user max, warning is generated
- supplier evidence has source URL or fixture id

#### Audit

必须记录:

- selected supplier id
- discarded supplier ids and why
- FX rate
- shipping estimate assumptions
- fulfillment warning if any

### 7.3 Margin Agent

#### Skill

角色:财务部 / 利润核算和敏感性分析。

目标:用 deterministic code 计算 low/base/high 三档利润,LLM 只解释 tradeoff。

重要原则:

- 模型不能自由算账。
- 财务公式用 TypeScript 函数计算。
- LLM 只能解释哪些成本项最敏感。

#### Tools

- deterministic margin calculator
- `shipping.estimateCrossBorder` if sourcing did not provide final estimate
- `fx.convert` if needed
- `risk.checkpoint("margin")`

#### Required formula

```txt
estimated_net_profit =
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

estimated_net_margin =
  estimated_net_profit / target_selling_price
```

#### Input

- sourcing output
- market price band
- user target margin
- default fee assumptions
- default category return/damage assumptions

#### Output

- suggested price
- minimum viable price
- gross margin
- low/base/high net profit
- low/base/high net margin
- cost breakdown
- sensitivity notes
- risk checkpoint summary

#### Harness

assertions:

- exact unit tests for cost formula
- base net margin around 28% for Mini Desk Vacuum mock assumptions
- bad case or high-return case around 12%
- output includes every cost component
- LLM text cannot override deterministic numbers
- if margin only works in optimistic case, Committee cannot get an automatic Go

#### Audit

必须记录:

- all cost assumptions
- formula version
- deterministic calculation result
- LLM explanation response id if used
- margin risk checkpoint output

### 7.4 Risk & Compliance Agent

#### Skill

角色:风控部 / 合规监督者。

目标:监督利润、上架、图片和投审会,让高风险不能被漂亮包装或高利润盖过去。

Risk 是 contract agent,也是 runtime supervisor。它有自己的 War Room 卡片,但在多个 checkpoint 更新状态。

#### Tools

- `shopee.getPolicyRules(market)`
- listing violation rule matcher
- category attribute validator
- claim checker
- `openaiImage.checkImageCompliance(imageUrl, rules)` when checking generated images

#### Checkpoints

```ts
risk.checkpoint(
  stage: "margin" | "listing" | "packaging" | "committee",
  payload: unknown
)
```

`margin` checkpoint:

- 是否存在利润只在乐观档成立。
- 退货、损耗、运费敏感性是否过强。
- 是否应封顶 Watch。

`listing` checkpoint:

- title/description 是否夸大吸力。
- 是否暗示医疗、工业级、认证或不存在功能。
- Shopee required fields 是否缺失。

`packaging` checkpoint:

- 图片 prompt 是否只包含真实商品属性。
- 图片是否暗示超强吸力、工业级、认证、安全承诺。
- feature image callouts 是否和 listing specs 一致。

`committee` checkpoint:

- 是否有 hard gate。
- 是否应限制最高只能 Watch。
- final decision 是否和风险等级一致。

#### Output

- `risk_score`
- `risk_level`
- `violation_flags`
- `human_review_required`
- `warnings`
- `checkpoint_results`
- `committee_caps`
- `evidence`

#### Harness

Mini Desk Vacuum 必须命中:

- exaggerated suction warning
- electrical safety / USB power review warning
- `risk_level = "medium"`
- `human_review_required = true`
- no hard prohibited flag unless真实规则命中

额外断言:

- high-risk synthetic product cannot become Go
- listing with "industrial grade suction" is flagged
- generated image that implies fake certification is `needs_review` or rejected

#### Audit

必须记录:

- policy rules version
- checkpoint input summary
- flags and reason
- hard gate or Watch cap decisions
- human review reason

### 7.5 Listing Agent

#### Skill

角色:电商运营部 / Shopee 上架结构化专员。

目标:把已经过市场、货源、利润和风险约束的商品,整理为可审核的 Shopee listing package。

Listing Agent 不再负责生成商品图片。它只产出文本字段、属性、SKU、价格、库存、物流和缺失字段。

#### Tools

- `shopee.getCategoryAttributes(categoryId)`
- title validator
- description validator
- SKU/variation normalizer
- `risk.checkpoint("listing")`

#### Input

- selected opportunity
- market output
- sourcing output
- margin output
- risk constraints
- seller brief

#### Output

- item_name
- category_id
- brand
- condition
- price
- stock
- sku
- variations
- attributes
- bullet points
- description
- logistics
- missing_fields
- compliance notes
- editable JSON fields

#### Harness

assertions:

- all required fields are filled or explicitly listed in `missing_fields`
- title does not contain exaggerated claims
- description includes safe usage and review warnings where appropriate
- risk warnings are reflected in listing wording
- no image prompts are produced here

#### Audit

必须记录:

- category attributes fetched
- required field mapping
- removed or rewritten risky claims
- listing risk checkpoint output

### 7.6 Packaging Agent

#### Skill

角色:营销部 / 商品包装和图片制作专员。

目标:为 Shopee Singapore 生成本地化包装角度、主图 prompt、生活方式图 prompt、功能卖点图 prompt,并在 live mode 生成图片。

Packaging Agent 是独立 agent。它接收 Listing Agent 的真实商品字段和 Risk Agent 的约束,不能为了好看编造产品能力。

#### Tools

- competitor style extractor
- prompt constraint builder
- `openaiImage.generateProductImage(prompt, constraints)`
- `openaiImage.editProductImage(sourceImage, prompt)`
- `openaiImage.checkImageCompliance(imageUrl, rules)`
- `risk.checkpoint("packaging")`

#### Input

- listing output
- market style notes
- product attributes
- package contents
- target market context
- risk constraints
- optional source product image

#### Output

- localized title angle
- platform style notes
- hero image prompt
- lifestyle image prompt
- feature image prompt
- generated image URLs
- image compliance notes
- fallback image URLs if live generation fails
- generated image metadata
- `selected_listing.images[]`

#### Prompt constraints

Prompts must include only real attributes:

- compact mini desk vacuum
- USB rechargeable or USB powered only if sourcing/listing supports it
- desk, keyboard, crumbs, home office, compact HDB apartment context
- size/weight if known
- package contents if known

Prompts must avoid:

- "super suction"
- "industrial grade"
- "medical grade"
- fake certification badges
- "guaranteed deep clean"
- claims about battery life not supported by supplier data
- impossible before/after transformations

#### Dry-run mode

Dry-run mode:

- creates prompts
- creates compliance notes
- does not call image API
- returns seed fallback image URLs

#### Live mode

Live mode:

- calls OpenAI image generation or editing
- saves images under `public/generated/<audit_run_id>/`
- calls image compliance checker
- if compliance fails, returns image but marks `needs_review` or `rejected`

#### Harness

assertions:

- dry-run mode makes no image API call
- prompt contains real product attributes only
- prompt avoids exaggerated words
- generated image metadata is attached to audit in live mode
- feature image compliance can become `needs_review`
- `selected_listing.images[]` has hero/lifestyle/feature entries

#### Audit

必须记录:

- prompt inputs
- final prompts
- constraints
- source image id if used
- image model
- image response id
- generated image path
- compliance result
- fallback reason if any

### 7.7 Committee Agent

#### Skill

角色:CEO / 投审会。

目标:汇总全部 agent 输出,做确定性打分、hard gate、Watch cap 和最终解释。

原则:

- 最终 Go/Watch/Reject 由 deterministic code 决定。
- LLM 可以写 Devil's Advocate 和 human-readable summary。
- 高利润不能覆盖高合规风险。
- 图片好看不能覆盖商品真实性。

#### Tools

- deterministic scoring function
- deterministic gate evaluator
- `risk.checkpoint("committee")`
- optional LLM explanation generator

#### Weights

```txt
profit:      30%
demand:      25%
compliance:  20%
fulfillment: 15%
packaging:   10%
```

#### Hard gates

直接 Reject:

- prohibited or restricted item with no safe review path
- IP or brand infringement risk
- impossible fulfillment
- missing critical Shopee required fields
- generated images materially mismatch product
- hard safety compliance issue

最高封顶 Watch:

- medium risk with human review required
- bad case margin below target
- data confidence too low
- image compliance needs review
- fulfillment close to user max

#### Output

- ranked opportunities
- final decision for each opportunity
- score breakdown
- tradeoff notes
- decision_reason
- Devil's Advocate if LLM used
- final summary

#### Harness

assertions:

- Mini Desk Vacuum decision is Watch
- high-risk product cannot become Go
- low-risk cable organizer can outrank desk vacuum
- decision_reason mentions both profit sensitivity and compliance review
- hard gate overrides weighted score
- Watch cap cannot accidentally promote Reject or Go incorrectly

#### Audit

必须记录:

- input score components
- gates fired
- Watch caps fired
- final deterministic decision
- optional LLM explanation response id

## 8. Contract Update TODO

这是第一优先级。不能先写前后端新 agent 再补契约。

### TASK-CONTRACT-7AGENT

Owner: backend + frontend contract owner

Paths:

- `contract/result.ts`
- `contract/result.schema.json`
- `contract/mock-result.json`
- `scripts/check-contract.mjs` if checker cannot catch the new constraints

Requirements:

- Add `packaging` to `AgentKey`.
- Add `packaging` to JSON schema enum.
- Add Packaging Agent result in `mock-result.json`.
- Keep Risk Agent result in `agents[]` but describe it as checkpoint supervisor.
- Add `audit_run_id` to `RunResult`.
- Add schema validation for `audit_run_id`.
- Move ownership of `selected_listing.images[]` to Packaging Agent in mock content.
- Listing Agent mock output should no longer claim it generated images.
- Mock primary opportunity remains Mini Desk Vacuum with decision `Watch`.
- Mock still includes low-risk cable organizer and high-risk reject example if useful for board ranking.

Acceptance:

- `node scripts/check-contract.mjs` passes.
- Frontend can render 7 agent cards from mock.
- `selected_listing.images[]` still renders without frontend rewrite beyond the new packaging card.
- Contract README states:images are produced by Packaging Agent.

## 9. API Roadmap

### `POST /api/run?mock=1`

Behavior:

- Return `contract/mock-result.json` immediately.
- No OpenAI call.
- No provider call.
- No image generation.
- Must stay available at all times.

Acceptance:

- Used as demo fallback.
- Same shape as live output.

### `POST /api/run?images=0`

Behavior:

- Run live or fixture text pipeline.
- Packaging Agent dry-run only.
- Return image prompts and fallback images.
- Useful for rehearsal when image generation is slow.

### `POST /api/run`

Behavior:

- Create `audit_run_id`.
- Run primary pipeline:
  `market -> sourcing -> margin -> listing -> packaging -> committee`
- Invoke risk checkpoints at margin/listing/packaging/committee.
- Validate final result against `contract/result.schema.json`.
- Return final `RunResult`.

Failure behavior:

- If provider API is unavailable, fallback to seed fixture and record audit warning.
- If one OpenAI text call fails after retry, convert that agent to `blocked` only if final contract can still validate.
- If image generation fails, return prompt plus fallback image and mark `needs_review`.
- Never return malformed JSON.

### `GET /api/runs/:id/audit`

Behavior:

- Return audit manifest and agent/tool summaries.
- Do not expose secrets or hidden model reasoning.
- Enough detail to prove the system used tools and live model calls.

## 10. Frontend Alignment

Frontend is owned separately, but backend roadmap must protect these integration points.

Pages:

- Seller Brief
- Agent War Room
- Opportunity Board
- Listing Studio
- ROI / Admin Summary

Allowed shortcuts:

- shadcn dashboard templates
- Tailwind components
- Recharts for margin and ROI charts
- mock-first rendering from `contract/mock-result.json`

Required frontend updates after contract task:

- War Room renders 7 agent cards.
- Risk card supports checkpoint timeline.
- Packaging card shows prompts, generated image URLs, image compliance notes and fallback state.
- Listing Studio reads images from `selected_listing.images[]`.
- Opportunity Board keeps Go/Watch/Reject badge and risk level.
- ROI Summary shows saved time, blocked risks and reusable templates.

## 11. Detailed Team TODO List

### Phase 0 - Docs and contract alignment

#### TASK-00 · Documentation consolidation · Done

Paths:

- `README.md`
- `docs/TASKS.md`
- this file

Completed:

- Kept exactly three main documents.
- Consolidated project intro, roadmap, and task execution.
- Deleted duplicate PRD, architecture, agent spec, committee, MVP scope, API notes, and per-track task docs.

Acceptance:

- New contributors can start from README and land on Roadmap + Tasks only.

#### TASK-CONTRACT-7AGENT · Update shared contract

See section 8.

This task must be completed before real 7-agent backend and frontend War Room work is merged.

### Phase 1 - App skeleton and mock path

#### TASK-01 · Next.js skeleton

Paths:

- `app/`
- `components/`
- `lib/`
- `.env.example`
- `package.json`
- `tsconfig.json`
- `tailwind.config.*`

Requirements:

- Next.js 14 App Router.
- TypeScript strict.
- Tailwind configured.
- `npm run dev` works.
- `npm run lint` or equivalent works.
- `POST /api/run?mock=1` returns mock.
- Contract types imported from `contract/result.ts`.

Acceptance:

- Browser can open app.
- `/api/run?mock=1` returns valid `RunResult`.

#### TASK-06 · Mock API hardening

Paths:

- `app/api/run/route.ts`
- `contract/mock-result.json`
- `scripts/check-contract.mjs`

Requirements:

- Zero OpenAI call in `mock=1`.
- Response headers prevent accidental caching bugs during local demo if needed.
- Include `audit_run_id` even in mock once contract changes.

Acceptance:

- `curl /api/run?mock=1` returns within one second locally.

### Phase 2 - Runtime, audit and providers

#### TASK-RUNTIME-AUDIT · Shared agent runtime

Paths:

- `lib/agent-runtime/run-agent.ts`
- `lib/agent-runtime/tool-runner.ts`
- `lib/agent-runtime/audit.ts`
- `lib/agent-runtime/schemas.ts`
- `lib/agent-runtime/errors.ts`
- `lib/agent-runtime/replay.ts`
- `lib/openai.ts`

Requirements:

- Responses API wrapper.
- Structured Outputs.
- Function calling loop.
- Tool input/output validation.
- Audit persistence.
- Retry and timeout.
- Fixture/live modes.

Acceptance:

- A fake test agent can call a fake tool, produce strict JSON, validate schema and write audit.

#### TASK-PROVIDERS-SEED · Provider adapters and seed fixtures

Paths:

- `lib/providers/shopee/*`
- `lib/providers/sourcing-1688/*`
- `lib/providers/shipping/*`
- `lib/providers/fx/*`
- `seed/**/*`

Requirements:

- Shopee provider supports fixture search/detail/category/policy.
- Sourcing provider supports fixture offer search/detail.
- Shipping provider supports low/base/high estimate.
- FX provider supports CNY to SGD conversion.
- Every provider output includes source or fixture id.

Acceptance:

- Market and Sourcing harness can run without network.

### Phase 3 - Agent implementation

#### TASK-MARKET · Market Trend Agent

Paths:

- `lib/agents/market/*`
- `seed/shopee/*`

Requirements:

- Implement skill/schema/tools/harness/index.
- Use Shopee search fixtures.
- Produce evidence-backed demand score, competitor count, price band and style notes.

Acceptance:

- Harness assertions in section 7.1 pass.

#### TASK-SOURCING · Sourcing Agent

Paths:

- `lib/agents/sourcing/*`
- `seed/sourcing-1688/*`
- `seed/shipping/*`
- `seed/fx/*`

Requirements:

- Implement skill/schema/tools/harness/index.
- Select supplier candidate.
- Estimate stock/MOQ/fulfillment/weight/dimensions.

Acceptance:

- Harness assertions in section 7.2 pass.

#### TASK-MARGIN · Margin Agent

Paths:

- `lib/agents/margin/*`
- `lib/agents/risk/*` for margin checkpoint integration

Requirements:

- Deterministic formula.
- Low/base/high scenarios.
- Cost assumptions versioned.
- LLM only for explanation.

Acceptance:

- Exact unit tests pass.
- Desk vacuum base margin and bad-case margin story is stable.

#### TASK-RISK · Risk & Compliance Agent

Paths:

- `lib/agents/risk/*`
- `seed/shopee/policy-rules-sg.json`

Requirements:

- Implement checkpoint API.
- Aggregate risk across margin/listing/packaging/committee.
- Flag exaggerated suction and electrical/USB power review.

Acceptance:

- Harness assertions in section 7.4 pass.

#### TASK-LISTING · Listing Agent

Paths:

- `lib/agents/listing/*`

Requirements:

- Generate Shopee field package.
- Validate required fields.
- Remove exaggerated claims.
- Call listing risk checkpoint.

Acceptance:

- Harness assertions in section 7.5 pass.

#### TASK-PACKAGING-IMAGE · Packaging Agent

Paths:

- `lib/agents/packaging/*`
- `lib/providers/openai-image/*`
- `public/generated/*`
- `seed/images/*`

Requirements:

- Generate localized title angle and platform style notes.
- Generate hero/lifestyle/feature prompts.
- Support dry-run mode.
- Support live OpenAI image generation.
- Save images to `public/generated/<audit_run_id>/`.
- Run image compliance checks.
- Populate `selected_listing.images[]`.

Acceptance:

- Harness assertions in section 7.6 pass.
- Live smoke test creates or gracefully falls back for 3 image slots.

#### TASK-COMMITTEE · Committee Agent

Paths:

- `lib/agents/committee/*`

Requirements:

- Deterministic weighted scoring.
- Deterministic hard gates.
- Deterministic Watch caps.
- Optional LLM summary only.
- Final risk checkpoint.

Acceptance:

- Mini Desk Vacuum is Watch.
- High-risk product cannot be Go.
- Reason mentions profit sensitivity and compliance review.

### Phase 4 - API integration

#### TASK-API-INTEGRATION · Wire real pipeline

Paths:

- `app/api/run/route.ts`
- `app/api/runs/[id]/audit/route.ts`
- `lib/agent-runtime/*`
- `lib/agents/*`

Requirements:

- Support `mock=1`.
- Support `images=0`.
- Support live text and live image path.
- Validate final `RunResult`.
- Return `audit_run_id`.
- Expose audit endpoint.

Acceptance:

- `POST /api/run?mock=1` passes.
- `POST /api/run?images=0` passes.
- `POST /api/run` live text path passes.
- Audit endpoint returns run proof.

### Phase 5 - Frontend integration

#### TASK-FE-BRIEF · Seller Brief

Requirements:

- English UI.
- Fixed MVP defaults for Shopee Singapore and Mini Desk Vacuum.
- Submit calls `/api/run` or `/api/run?mock=1` depending demo mode.

#### TASK-FE-WARROOM · Agent War Room

Requirements:

- 7 agent cards.
- agent status: waiting/running/done/blocked.
- risk checkpoint timeline.
- evidence, score, confidence, warnings.
- audit link if available.

#### TASK-FE-BOARD · Opportunity Board

Requirements:

- 3 opportunity cards.
- Go/Watch/Reject badge.
- risk level.
- margin chart with low/base/high, preferably Recharts.
- reason bullets.

#### TASK-FE-LISTING · Listing Studio

Requirements:

- Shopee fields editor.
- bullet points and description editor.
- image preview from `selected_listing.images[]`.
- show Packaging Agent prompts and compliance notes.
- copy JSON/CSV.

#### TASK-FE-ROI · ROI/Admin Summary

Requirements:

- manual vs agent time saved.
- risks blocked.
- reusable listing template.
- reusable packaging prompt.
- next monitoring items.

### Phase 6 - Harness, tests and CI

#### TASK-HARNESS-QA · Agent harness runner

Paths:

- `lib/agents/*/harness.ts`
- `scripts/*`
- `.github/workflows/*`

Requirements:

- Run each harness independently.
- Run all harnesses together.
- Provide fixture replay mode.
- Provide optional live smoke mode gated by env vars.

Acceptance:

- Local command validates all agent fixtures.
- CI runs contract check and fixture harness.
- Live smoke test is manual or opt-in, not required for every PR.

#### TASK-CONTRACT-CI · Stronger schema validation

Requirements:

- Keep current zero-dependency checker.
- Optionally add Ajv once package skeleton exists.
- Validate enums, required fields and nested shape more completely.

Acceptance:

- Contract drift fails PR check.

### Phase 7 - Demo hardening

#### TASK-DEMO-LIVE · Live run rehearsal

Requirements:

- Capture one successful live text run.
- Capture one successful live image run.
- Capture one image fallback run.
- Verify audit can explain each run.

Acceptance:

- Demo can survive:
  - OpenAI text latency
  - image generation failure
  - provider fixture fallback
  - partial agent warning state

#### TASK-PITCH · Narrative and backup plan

Requirements:

- One-line pitch:
  `Zero-person company. One AI commerce team. Endless product opportunities.`
- Show why Watch is a feature, not a failure.
- Explain "profit-aware before copywriting".
- Prepare fallback screenshots/video if network is unstable.

Acceptance:

- Pitch matches live UI and contract fields.

## 12. Open-source / low-work dependencies

Use these to reduce build time:

- Next.js App Router for API routes and pages.
- shadcn/ui dashboard blocks for frontend scaffolding.
- Tailwind for styling.
- Recharts for margin and ROI charts.
- OpenAI official JS SDK for Responses API and image generation.
- Zod for agent input/output schemas.
- `zod-to-json-schema` or hand-authored JSON schema for Structured Outputs.
- Vitest for deterministic margin, committee and harness tests.
- Ajv for stronger runtime contract validation once dependencies exist.
- `nanoid` or `crypto.randomUUID()` for `audit_run_id`.

Avoid for MVP:

- LangChain/CrewAI orchestration.
- A full workflow engine.
- Database dependency before demo path is stable.
- Real Shopee write-back.

## 13. Env Vars

`.env.example` should evolve toward:

```txt
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=gpt-4o
OPENAI_IMAGE_MODEL=gpt-image-1
DEMO_MOCK_ONLY=false
LIVE_IMAGE_GENERATION=true
PROVIDER_MODE=fixture
AUDIT_STORAGE=local
```

Notes:

- `DEMO_MOCK_ONLY=true` forces `/api/run` to behave like mock for emergency demo.
- `LIVE_IMAGE_GENERATION=false` should make Packaging Agent dry-run prompts and fallback images.
- `PROVIDER_MODE=fixture` means Shopee/1688 data comes from seed, while OpenAI can still be live.

## 14. Documentation Rule

The repository intentionally keeps only three main documents:

- `README.md`
- `docs/IMPLEMENTATION-ROADMAP.md`
- `docs/TASKS.md`

Do not add parallel PRD, architecture, agent spec, committee spec, MVP scope, or per-track task markdown files. If a new decision is strategic or architectural, update this roadmap. If it is execution work, update `docs/TASKS.md`. If it is project positioning, update `README.md`.

## 15. Definition of Done

MVP is done when:

- `contract/result.ts`, `contract/result.schema.json`, `contract/mock-result.json` agree on 7 agents.
- `node scripts/check-contract.mjs` passes.
- `/api/run?mock=1` returns instantly.
- `/api/run?images=0` runs text pipeline and prompt-only Packaging Agent.
- `/api/run` can live-call OpenAI text agents.
- Packaging Agent can live-generate or gracefully fallback for hero/lifestyle/feature images.
- Risk Agent flags Mini Desk Vacuum exaggerated suction and electrical/USB safety review.
- Margin Agent produces stable low/base/high story.
- Committee Agent deterministically returns `Watch` for Mini Desk Vacuum.
- War Room shows 7 agents, with Risk checkpoint timeline.
- Listing Studio shows Shopee fields, Packaging prompts, images and compliance notes.
- Audit endpoint proves tool calls, model response ids, schema validation, latency and warnings.

## 16. Golden Demo Script

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
   - Risk flags suction claim and USB/electrical review.
   - Listing creates safe Shopee fields.
   - Packaging generates localized prompts and live images.
   - Committee gives Watch.
5. Opportunity Board shows:
   - Mini Desk Vacuum: Watch
   - Cable organizer: Go or safer comparison if present
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
