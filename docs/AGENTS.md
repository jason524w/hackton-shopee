# Agent 规格 — 6 个 agent

每个 agent = 一次 OpenAI Responses API 调用,`response_format` 用 strict json_schema,
输出直接是 `contract/result.ts` 里对应的结构。实现放 `lib/agents/<key>.ts`。

公共约定:
- 输入是上游 agent 的输出 + `brief`。
- 输出里的 `score` 0–100、`confidence` 0–1。
- 每个 agent 都要产 `evidence[]`(给 War Room 展示)和 `key_judgment`(一句话结论)。
- prompt 里强约束:**只能基于传入的数据/工具结果判断,不要凭记忆编造**(控幻觉)。

---

## 1. `market` — Market Trend Agent
- **职责**:发现目标市场需求、热度、竞品价格;产出 3 个候选商品方向。
- **输入**:`brief`(market/platform/category/product_intent/budget)。
- **工具**:`search_shopee(query)` → 读 `seed/`;可选 Web Search。
- **输出**:`directions[]`(3 个,标 1 个 `is_primary`)+ 每个的 demand 信号、价格带、竞品数。
- **判断**:需求信号是否足够、价格带分布、是否适合轻资产、是否过热同质化。

## 2. `sourcing` — Sourcing Agent
- **职责**:为 **primary 候选**找低价货源,判断库存与履约可行性。
- **输入**:primary direction + `brief`(max_fulfillment_days/budget)。
- **工具**:`get_1688_quotes(query)` → 读 `seed/`。
- **输出**:supplier 候选、source_price、MOQ、stock、履约天数、包装重量/尺寸、sourcing_risk。
- **判断**:价差够不够、库存够不够、能否在平台履约上限内、供应商是否稳定。

## 3. `margin` — Margin Agent(护城河)
- **职责**:套利润公式,算 low/base/high 三档 + cost 瀑布。
- **输入**:source_price、suggested_price、市场、平台费率、退货/损耗默认值、包装重量。
- **输出**:`margin`(base/low/high + `cost_breakdown[]`)、recommended_price、min_viable_price、profit score。
- **公式**:见 [ARCHITECTURE.md](ARCHITECTURE.md#利润模型护城河务必做实)。
- **判断**:净利低于用户目标 → Watch/Reject;利润只在乐观档成立 → 交 Committee 给 Watch。

## 4. `risk` — Risk & Compliance Agent(护城河)
- **职责**:检查商品/平台/履约/内容风险,打分。
- **输入**:商品名、类目、描述、图片说明、市场、平台、供应商信息。
- **工具/知识**:`seed/` 里的 Shopee 禁售 & listing-violation 规则摘要。
- **检查维度**:禁售限售、品牌/IP 侵权、电器认证、夸大宣传、keyword/属性 spam、
  重复 listing、价格 spam、图文不符、履约过长、售后不清。
- **输出**:risk_score、`risk_level`、violation flags、required_human_review、warnings。
- **判断**:高风险→只能 human review;中风险→可生成但带 warning;低风险→可 Go。
- **Demo 关键**:对吸尘器必须输出「⚠ 夸大吸力 / 电器安全需人工复核」。

## 5. `listing` — Listing & Packaging Agent
- **职责**:把 primary 候选转成 Shopee 可上架字段 + 本地化标题/卖点/描述 + 图 prompt。
- **输入**:selected product、市场、类目、recommended_price、stock、规格、`risk` 的约束。
- **输出**:`selected_listing.shopee`(完整字段)+ bullet_points + images(prompt + 预生成 url)
  + missing_fields。
- **判断**:必填字段缺 → 不能标 ready;Risk 有 warning → 必须写进 listing compliance。
- **约束**:按 Risk 改写卖点,去掉夸大词;本地化加 HDB/office/dorm 场景。

## 6. `committee` — Committee Agent
- **职责**:汇总全部 agent,处理 tradeoff,给最终 Go/Watch/Reject + 排序 + 解释。
- **输入**:上面 5 个 agent 的输出 + `brief`。
- **输出**:`committee`(ranked_ids、weights、tradeoffs、summary)+ 写回每个 opportunity 的 decision。
- **权重**:profit 30 / demand 25 / compliance 20 / fulfillment 15 / packaging 10。
- **硬拦截**:禁售、IP 侵权、图文不符、履约不可行、关键字段缺失 → Reject/Human Review。
- **判断**:利润高但风险高不直接 Go;热度高但货源不稳不直接 Go;数据不足但有潜力 Watch。

---

## 实现顺序建议(P1)
先 `mock` 跑通整条管道接线(每个 agent 先返回 mock 片段),再逐个换成真实 OpenAI 调用。
**任何时候 `/api/run` 的整体输出都要能通过 `contract/result.schema.json`。**
