# Agent 规格 — 7 个 agent

> **后端权威以 [IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md) 为准**(7-agent + runtime/
> providers/audit/harness 的完整实施规范、目录结构、checkpoint)。本文件是职责简表。
> 顺序:`market → sourcing → margin → risk → listing → packaging → committee`。

每个 agent = 一次 OpenAI Responses API 调用,`response_format` 用 strict json_schema。
实现放 `lib/agents/<key>/`(目录化,见 ROADMAP §3/§4)。

> **契约边界(重要):** contract 只定义**最终汇总的 `RunResult`**。下面每个 agent 的
> "输出"是**内部中间产物**(directions[]、supplier、flags、ranked… ),**其 schema 由 P1
> 自由决定,不属于 contract**。P1 在 `app/api/run` 里把这些中间产物**汇总**成 `RunResult`,
> **只有这个最终对象必须通过 `contract/result.schema.json`**(用 `scripts/check-contract.mjs` 验)。

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

## 5. `listing` — Listing Ranker Agent
- **职责**:消费上游 canonical opportunity scores,用工具证据做筛选/解释,决定哪个商品进入 Packaging handoff;不负责最终上架。
- **输入**:opportunities、市场/类目、margin、货源/物流/FX、Shopee SG 规则、近期/本地 market context、`risk` 约束。
- **工具**:`shopee.searchProducts`、`sourcing1688.searchOffers/getOfferDetail`、`shipping.estimateCrossBorder`、`fx.convert`、`shopee.getPolicyRules`、Singapore market context。
- **输出**:内部 `ranked_ids`、factor diagnostics、filters、tradeoffs + 给 Packaging 的 `selected_listing` handoff 外壳。
- **判断**:LLM 不是数据源,只能基于工具结果做 tradeoff;硬拦截先过滤;上游 primary/用户选择若未硬拦截,可保留进入 Packaging 并带 warning;不覆盖 Market 的 `is_primary`。
- **约束**:不生成最终上架、不生成图片;handoff 的 `editable_json_ready=false`;禁止把模型训练偏好当成新加坡近期趋势证据。

## 6. `packaging` — Packaging Agent
- **职责**:接收 Listing Ranker 的 handoff,完成 Shopee-ready 上架包文案、本地化包装 + 商品图(hero/lifestyle/feature)prompt 生成、live 生成与图片合规。
- **输入**:selected_listing handoff、市场、竞品风格、产品规格、`risk` 约束、可选 source 图。
- **工具**:`openaiImage.generate/edit/checkCompliance`、`risk.checkpoint("packaging")`。
- **输出**:`selected_listing.images[]`(hero/lifestyle/feature + prompt + compliance)+ 本地化卖点/风格说明。
- **判断**:prompt 只用真实规格、不暗示不存在的功能/认证;feature 图与 listing 规格逐项对齐;可标 `needs_review`。
- **模式**:dry-run 只产 prompt 不调图 API;live 生成存 `public/generated/<run_id>/`。
- **接线约束**:`/api/run` 不能只接 Listing 就把 handoff 展示为最终 Listing Studio;Packaging 必须成对接线并决定最终 ready 状态。
- **Demo 关键**:图必须由真实规格驱动,不是漂亮但不可信的广告图。

## 7. `committee` — Committee Agent
> **实现权威见 [design/committee.md](design/committee.md)(pure-A)**:**LLM 直接定 Go/Watch/Reject**;
> 确定性加权/gate 降级为证据 + 失败兜底;硬红线(禁售/高风险不能 Go)由 skill 指令 + eval 保障(**软约束,非代码硬闸**)。
> COMMITTEE.md §1 的"确定性 gate 决策"已被推翻(见其顶部 banner)。零 contract 改动。
- **职责**:汇总全部 agent,处理 tradeoff,给最终 Go/Watch/Reject + 排序 + 解释。
- **输入**:上面 5 个 agent 的输出 + `brief`。
- **输出**:`committee`(ranked_ids、weights、tradeoffs、summary)+ 写回每个 opportunity 的 decision。
- **权重**:profit 30 / demand 25 / compliance 20 / fulfillment 15 / packaging 10。
- **硬拦截**:禁售、IP 侵权、图文不符、履约不可行、关键字段缺失 → Reject/Human Review。
- **判断**:利润高但风险高不直接 Go;热度高但货源不稳不直接 Go;数据不足但有潜力 Watch。

---

## 实现顺序建议(P1)
先实现管道调度器 + 各 agent 的 strict json_schema 定义,再按 market → sourcing → margin →
risk → listing → packaging → committee 顺序逐个实现真实调用;每实现一个,跑一次端到端。
fixture 注入只允许出现在测试代码(`__tests__/`)。
**任何时候 `/api/run` 的整体输出都要能通过 `contract/result.schema.json`。**
