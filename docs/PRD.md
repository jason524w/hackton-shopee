# Sea Launch AI PRD

## 1. 产品名字与一句话定位

### 产品名字

**Sea Launch AI**

选择这个名字，是因为它同时覆盖 Sea / Southeast Asia / launch 三层含义：既贴合 Sea x OpenAI Codex Hackathon 的语境，也能表达“帮助卖家把商品机会 launch 到东南亚电商市场”的产品目标。

### Slogan

**用 Multi-Agent 帮轻资产卖家发现利润机会，并自动生成东南亚电商上架包。**

英文版：

**A multi-agent commerce operator that turns product intent into profit-aware SEA marketplace launch packs.**

Demo 叙事版：

**把一个卖家的商品想法，在几分钟内变成可计算利润、可检查风险、可上架的 Shopee 商品包。**

### 一句话产品定位

Sea Launch AI 是一个面向个人 dropshipper 和中小跨境卖家的 AI-native 电商运营系统，帮助他们在进入 Shopee / Lazada 等东南亚电商平台时，自动完成商品机会发现、低价货源匹配、利润测算、风险检查、本地化包装和可审核上架包生成。

当前产品主平台优先聚焦 **Shopee**，因为它与 Sea 的生态和本次 hackathon 背景最贴合；Lazada 作为可扩展平台，用来证明系统具备跨平台字段转译能力。

### 产品表达原则

Sea Launch AI 的核心表达统一为：

**Profit-aware cross-border commerce operations.**

它的商业本质是发现跨境价格差和利润机会，但产品叙事不使用“自动套利工具”作为主标题。原因是 Sea Launch AI 并不是鼓励卖家绕过平台规则，而是把商品机会变成一个可计算利润、可检查风险、可本地化包装、可人工确认的 Shopee-ready 上架方案。

统一使用的关键词：

- Profit-aware commerce
- Cross-border product opportunity
- AI-native seller operations
- Shopee-ready launch pack
- Human-approved listing workflow

## 2. 背景与问题

### Hackathon 背景

Sea x OpenAI Codex Hackathon 是 Sea 和 OpenAI 在新加坡启动的区域 Codex Hackathon。活动方向包括：

- Autonomous & Adaptive AI
- AI-Native Products & Operations
- Deep Domain AI

Sea 是 Shopee 背后的重要公司之一，活动嘉宾包括 Shopee 的产品负责人。对这个 hackathon 来说，一个围绕 Shopee / 东南亚电商卖家运营的 AI-native 产品，天然贴合 Sea 的业务场景，也能展示 OpenAI / Codex 在真实行业 workflow 中的价值。

Sea Launch AI 最贴合的方向是 **AI-Native Products & Operations**：它不是给传统电商工具加一个聊天框，而是把原本由选品、采购、财务、合规、设计、运营共同完成的流程，重新拆成一个 multi-agent operating team。

同时它也能覆盖：

- **Autonomous & Adaptive AI**：agent 能在价格、库存、风险、平台规则变化时重新评估商品机会。
- **Deep Domain AI**：系统需要理解电商真实业务逻辑，包括 SKU、平台字段、运费、税费、退货率、履约时间、商品图、标题违规和 listing 风险。

参考：

- Sea x OpenAI Codex Hackathon announcement: https://www.sea.com/news/395
- OpenAI interview with Sea / Shopee product leadership: https://openai.com/index/sea-david-chen/
- Event page summary: Sea x OpenAI Regional Codex Hackathon - Singapore

### 用户背景

目标用户是想进入东南亚电商市场、但缺少完整运营能力的轻资产卖家：

- 个人 dropshipper
- 新加坡本地小卖家
- 想出海到 SEA 市场的中文中小商家
- 有货源但缺少海外电商包装能力的小工厂 / 贸易商
- 想快速测试商品机会但没有完整运营团队的创业者

这类用户的共同特点是：资金有限、不想大量囤货、希望快速试错、缺少选品和本地化能力，也很难同时处理货源、利润、平台规则、图片、文案、SKU 和上架字段。

### 核心痛点

1. **不知道卖什么**
   - 不知道哪些商品在东南亚市场有需求。
   - 不知道热点来源是否可信。
   - 不知道 TikTok / Shopee / Lazada / 海外内容里看到的爆品是否还能卖。

2. **不知道利润是否成立**
   - 只看到国内低价和海外高价，但没有完整计算采购价、国际运费、关税、平台费、退货损耗和履约成本。
   - 很多商品看起来有差价，但真实利润可能被物流、退货、平台费用吃掉。

3. **不知道哪里找货源**
   - 如果用户已有商品想法，需要找到更低价、更稳定、更适合履约的货源。
   - 如果用户没有商品想法，需要系统主动推荐可测试的商品方向。

4. **不知道如何本地化包装**
   - Shopee / Lazada 的标题、图片、描述、卖点、SKU、规格、属性字段都需要符合本地用户习惯。
   - 同一个商品在新加坡、马来西亚、菲律宾等市场可能需要不同风格。

5. **不知道平台风险**
   - 商品可能涉及禁售、品牌侵权、重复 listing、虚假图片、夸大宣传、价格 spam、关键词 spam、错误类目或履约时间过长。
   - 用户往往只关注“能不能卖”，但忽略“能不能合规地卖”。

6. **缺少自动化闭环**
   - 传统流程需要人工调研、找货、算账、写文案、做图、填字段、评估风险。
   - Sea Launch AI 的目标是把这套流程压缩成一个可视化、可审核、可复用的 agent workflow。

## 3. 竞品与替代方案分析

### Shopify 与 Shopify Dropshipping Apps

Shopify 官方将 dropshipping 定义为一种“不自己存货、不自己发货，由供应商代发给客户”的商业模式。它提供建站、商品管理、订单管理和大量 dropshipping / print-on-demand app。

局限：

- 更偏独立站，不是 Shopee / Lazada 这类 SEA marketplace 原生上架流程。
- 解决的是建店、供应商连接和订单管理，不一定解决“这个商品在 SEA 市场是否值得卖”。
- 很多 app 帮用户导入商品，但不会深度解释利润、风险、本地化逻辑和平台 listing 字段。

Sea Launch AI 的差异：

- 聚焦 SEA marketplace，而不是泛电商建站。
- 输出平台上架包，而不是只给商品导入。
- 使用多 agent 分别处理市场、货源、利润、风险和包装，而不是单一商品搬运。

参考：

- Shopify dropshipping overview: https://help.shopify.com/en/manual/products/dropshipping
- What is dropshipping: https://help.shopify.com/en/manual/products/dropshipping/what-is-dropshipping
- Types of dropshipping: https://help.shopify.com/en/manual/products/dropshipping/what-is-dropshipping/types-of-dropshipping

### 1688 / 货源工具 / 跨境供应链工具

1688、拼多多和类似货源平台可以提供低价商品、供应商、库存和采购入口。它们适合作为 sourcing data source。

局限：

- 更偏货源侧，不负责判断商品在 Shopee / Lazada 是否能卖。
- 不自动生成海外平台本地化标题、图片、描述和 SKU 字段。
- 不完整处理平台规则、侵权风险、履约风险和利润模型。

Sea Launch AI 的差异：

- 不只是找便宜货，而是把便宜货转化成一个可审核的跨境商品机会。
- 把货源数据、市场需求、利润、风险和上架包装统一到一个 agent 决策链里。

### ERP / 店铺管理工具

传统电商 ERP 更擅长订单、库存、发货、店铺管理和多平台同步。

局限：

- 通常发生在“商品已经决定要卖”之后。
- 不解决早期的选品、利润机会发现和本地化包装。
- 对新手或轻资产卖家来说，上手成本较高。

Sea Launch AI 的差异：

- 发生在“卖什么、怎么卖、值不值得卖”的前置阶段。
- 更像一个 AI 运营外包团队，而不是后台管理系统。

### 人工运营外包

人工运营团队可以做选品、修图、文案、定价、上架和监控。

局限：

- 成本高，速度慢。
- 很难快速测试大量商品方向。
- 判断过程不透明，难以复用。

Sea Launch AI 的差异：

- 把人工运营团队拆成 agent team。
- 输出结构化证据、评分和上架包。
- 可以把成功包装逻辑沉淀成 skill / template，持续复用。

## 4. 产品目标

Sea Launch AI 的目标不是承诺用户一定赚钱，而是帮助用户显著降低跨境电商冷启动的试错成本。

核心目标：

- 从用户意图出发，自动发现商品机会。
- 对候选商品做利润、风险和履约可行性判断。
- 生成平台可用的上架字段、标题、描述、图片方案和 SKU 信息。
- 让用户看到 agent 的证据、推理过程和最终推荐。
- 保留 human approval，让用户在上架和采购前进行确认。

产品最终呈现不是一段 AI 建议，而是一个完整的 **Commerce Launch Pack**。

### 产品最强卖点

Sea Launch AI 最强的点不是“帮用户写商品标题”，而是帮用户发现和验证赚钱机会：

> We do not only generate content. We automate the commerce decision before content is generated.

系统先判断这个商品有没有市场、有没有货源、有没有利润、有没有平台风险，再生成标题、图片、SKU 和上架字段。文案和图片是最后一步，核心价值是 **profit-aware commerce decision automation**。

产品不承诺“保证赚钱”，而是明确表达：

> Sea Launch AI reduces the cost of testing profitable product opportunities.

中文口径：

> 我们不承诺销量，但我们把测试一个赚钱商品机会的成本降到最低。

## 4.1 数据来源与估算逻辑

Agent 推荐必须尽量基于真实数据，而不是纯 prompt 生成。系统中的数据可以分成四层：

### 第一层：真实市场信号

用于判断“这个方向是否有人买、是否有竞争、是否有热度”。

可用来源：

- Shopee 搜索结果：商品标题、价格区间、评论数、评分、店铺类型、是否有销量标签。
- Shopee Ads / Seller Centre 信号：Shopee Ads 产品推荐里存在 Best Selling、Good ROAS、Top Searched 等高潜商品标签，可作为产品未来接入的市场信号方向。
- Shopee / Lazada 类目页面：类目、子类目、价格带、常见标题结构、商品图风格。
- Web search：新闻、博客、购物指南、社媒趋势文章。
- 用户上传的商品链接、图片或关键词。

输出给 Market Trend Agent：

- demand_signal_score
- competitor_count
- price_band
- review_density
- rating_distribution
- trend_source_links

参考：

- Shopee Ads product recommendations: https://ads.shopee.sg/news/853
- Shopee home appliances category page: https://shopee.sg/list/home%20appliances

### 第二层：真实货源信号

用于判断“能不能低价买到、库存够不够、履约能不能成立”。

可用来源：

- 1688 / 拼多多 / 其他货源平台搜索结果。
- 供应商报价、库存、起订量、发货地、商品规格。
- 商品包装尺寸和重量。
- 用户已有供应商资料。

输出给 Sourcing Agent：

- source_price
- supplier_candidates
- available_stock
- min_order_quantity
- estimated_domestic_shipping_time
- package_weight
- package_dimensions

### 第三层：估算模型

用于判断“看起来有差价，扣完成本后是否还有利润”。

建议利润公式：

```text
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
```

建议利润率公式：

```text
estimated_net_margin = estimated_net_profit / target_selling_price
```

估算逻辑：

- 月销量可以先用评论数、销量标签、排名、竞品数量和价格带做 proxy，不写成真实销量承诺。
- 退货率和损耗率按品类设置默认值，并允许用户调整。
- 运费和税费先做区间估算，UI 中展示 low / base / high 三档。
- 如果利润只在乐观假设下成立，Committee Agent 不直接给 Go，而是给 Watch。

### 第四层：平台字段与规则

用于判断“是否可以变成一个可审核的 Shopee listing package”。

可用来源：

- Shopee Open Platform / Seller Centre 字段结构。
- Shopee 商品类目和属性。
- Shopee listing violation / prohibited items policy。
- Lazada CreateProduct API 作为跨平台字段转译参考。

输出给 Listing Agent 和 Risk Agent：

- required_fields
- category_attributes
- missing_fields
- violation_flags
- human_review_required

参考：

- Shopee API access overview: https://help.shopee.sg/10/article/191702-API-Access
- Shopee prohibited and restricted items policy: https://help.shopee.sg/portal/4/article/77151
- Shopee listing violation guide: https://cdngarenanow-a.akamaihd.net/shopee/seller/seller_cms/57eedfed7dfd35ddb5700002da951ac0/%5BSG%5D%20Listing%20Violations%20Guide.pdf
- Lazada CreateProduct API: https://lazada-sellercenter.readme.io/docs/createproduct

## 5. 用户旅程

### Step 1: Seller Brief

用户进入 Sea Launch AI 后，填写一份轻量 brief：

- 目标市场：Singapore / Malaysia / Philippines / Thailand 等。
- 目标平台：Shopee 为主，Lazada 作为扩展。
- 用户类型：个人 dropshipper / 小卖家 / 工厂 / 跨境贸易商。
- 商品方向：已有明确商品、已有图片/链接，或只知道大类。
- 品类大类：家居小电、宠物用品、收纳生活用品、电子配件等。
- 初始预算：可接受采购预算和测试预算。
- 期望利润率：例如 20% / 30% / 50%。
- 履约周期：可接受发货和送达时间。
- 风险偏好：稳健 / 平衡 / 高利润高风险。
- 语言偏好：中文 / 英文 / 双语。

如果用户已有商品，可以上传：

- 商品图片
- 商品链接
- 商品关键词
- 已有供应商报价

如果用户没有商品，系统从市场机会开始推荐。

### Step 2: Agent War Room

系统进入 agent 分析界面。这里不建议做成纯聊天流，而是做成一个可视化作战室：

- 每个 agent 有独立状态：waiting / running / done / blocked。
- 每个 agent 展示输入、证据、关键判断、输出分数。
- 用户能看到 agent 不是在“假装思考”，而是在围绕市场、货源、利润、风险、包装做结构化判断。

Agent 运行顺序：

1. Market Trend Agent 收集市场信号。
2. Sourcing Agent 匹配低价货源。
3. Margin Agent 计算利润空间。
4. Risk & Compliance Agent 检查平台和商品风险。
5. Listing & Packaging Agent 生成商品包装方案。
6. Committee Agent 汇总并排序推荐。

### Step 3: Opportunity Board

系统输出 3-5 个候选商品机会。每个商品卡片展示：

- 商品名称
- 目标平台
- 目标市场
- 货源参考价
- 建议售价
- 预计毛利
- 预计净利润
- 库存状态
- 履约周期
- 市场热度
- 风险等级
- 推荐动作：Go / Watch / Reject
- 关键推荐理由

用户可以选择其中一个商品进入上架包装。

### Step 4: Listing Studio

用户选择商品后，Listing Studio 生成完整上架包：

- Shopee listing package
- Lazada listing package
- 本地化商品标题
- 商品卖点
- 商品描述
- SKU / variation
- 建议定价
- 图片生成 prompt
- 商品图预览
- 包装风格说明
- 风险提示
- 可复制 JSON / CSV

用户可以编辑 agent 输出，并在最终确认前查看所有字段。

商品图预览不是静态占位图，而是由系统根据商品规格、平台风格和目标地区自动生成。生成链路包括：

1. 从商品信息中提取真实属性：尺寸、颜色、使用场景、功能边界、包装内容。
2. 从竞品中学习平台风格：主图构图、卖点排列、背景风格、生活方式场景。
3. 根据目标地区生成本地化 prompt：例如 Singapore HDB home office、student dorm、humid weather、compact apartment 等。
4. 调用 OpenAI 图像生成 / 编辑能力生成商品主图、场景图和卖点图。
5. 由 Risk & Compliance Agent 检查图片是否夸大功能、误导消费者或与商品实物不一致。
6. 用户在 Listing Studio 中审核并选择最终图片。

本地化适配不仅包括语言翻译，也包括场景、审美、卖点排序和平台风格的适配。

### Step 5: ROI / Admin Dashboard

最后展示这个 agent workflow 带来的运营价值：

- 人工选品预计耗时 vs Agent 选品耗时
- 人工上架准备耗时 vs Agent 上架包生成耗时
- 商品预计利润空间
- 被风险 agent 拦截的问题
- 可复用的包装 skill / prompt / listing template
- 后续监控项：价格变化、库存变化、竞品变化、销量估算变化

## 6. UI / UX 设计

### 页面 1: Seller Brief

目标：让用户在 1-2 分钟内告诉系统“我要进入哪个市场、卖什么方向、预算是多少”。

核心组件：

- 市场选择器
- 平台选择器
- 品类选择器
- 预算输入
- 利润率目标
- 履约周期选择
- 商品线索上传区
- 风险偏好选择
- Start Agent Run 按钮

设计重点：

- 不要像复杂 ERP。
- 第一屏要让用户感觉“我只要给目标，agent team 会接管后续运营分析”。
- 输入项要足够结构化，避免完全开放式 prompt 导致结果不稳定。

### 页面 2: Agent War Room

目标：展示 multi-agent 的工作过程和可信度。

核心组件：

- Agent 状态栏
- Agent 卡片
- Evidence drawer
- Score breakdown
- Timeline
- Committee summary

每个 agent 卡片展示：

- 当前任务
- 使用的数据来源
- 当前结论
- Confidence score
- 需要注意的问题

设计重点：

- 不要只显示“Agent is thinking”。
- 要展示证据、评分、冲突和最终判断。
- 可以让不同 agent 的结论出现冲突，例如利润高但风险高，然后由 Committee Agent 做权衡。
- 页面上要突出赚钱机会本身：每个候选商品都要展示 estimated net profit、margin range 和 confidence，而不是只展示文案生成进度。

### 页面 3: Opportunity Board

目标：让用户快速比较多个商品机会。

核心组件：

- 商品机会表格 / 卡片
- 利润柱状图
- 风险 badge
- Go / Watch / Reject 标签
- Compare 按钮
- Select for Listing 按钮

设计重点：

- 用户要一眼看懂哪个商品更值得测。
- 商品不是按“看起来热门”排序，而是按利润、风险、履约和市场信号综合排序。
- 默认排序使用 profit opportunity score，但所有高风险商品都不能因为利润高而排到最前。

### 页面 4: Listing Studio

目标：把 agent 推荐转化成可执行的上架包。

核心组件：

- 平台 tab：Shopee / Lazada
- 商品标题编辑器
- 描述编辑器
- SKU 表格
- 价格与库存设置
- 图片预览
- 图片 prompt
- 地区本地化版本切换
- 图片生成 / 重新生成按钮
- 主图 / 场景图 / 卖点图分组
- JSON payload preview
- Compliance checklist

设计重点：

- 让评委看到最终输出不是泛泛建议，而是接近真实平台上架的结构化结果。
- 输出必须可复制、可编辑、可审核。
- 图片生成要和商品真实属性绑定，不能只生成漂亮但不可信的广告图。
- 同一商品可以针对 Singapore / Malaysia / Philippines 等市场生成不同标题、图片 prompt 和卖点排序。

### 页面 5: ROI Dashboard

目标：解释商业价值。

核心组件：

- Time saved
- Estimated margin
- Risk avoided
- Human team vs Agent team 对比
- Launch Pack summary
- Next monitoring tasks

设计重点：

- 不要承诺一定赚钱。
- 强调降低试错成本、提高上架速度、减少合规风险。

## 7. Agent 详细设计

### Agent 设计原则

Sea Launch AI 使用 multi-agent，不是为了把一个模型拆成多个名字好看的模块，而是因为跨境电商运营本身就是多职能协作：

- 市场热度高，不代表利润成立。
- 货源便宜，不代表履约稳定。
- 利润高，不代表平台合规。
- 图片好看，不代表商品真实可信。
- 上架字段完整，不代表值得上架。

因此每个 agent 都代表一个真实运营角色，并且它们之间允许产生冲突。系统最有价值的地方，是让这些冲突被看见、被解释、被 Committee Agent 汇总成一个可执行决策。

### 7.1 Market Trend Agent

职责：

发现目标市场里的潜在需求、热门趋势、竞品价格和商品机会。

输入字段：

- target_market
- target_platform
- category
- user_keywords
- user_uploaded_image
- budget_range
- language_preference

工具 / 数据来源：

- Web search
- Shopee / Lazada 商品样例
- 社媒趋势摘要
- 新闻 / 内容平台热点
- 用户上传的图片或关键词

输出字段：

- trend_summary
- demand_signals
- competitor_examples
- estimated_market_interest
- recommended_product_directions
- source_links
- confidence_score

判断逻辑：

- 是否有足够多的竞品和需求信号。
- 是否存在价格带分布。
- 是否适合轻资产卖家测试。
- 是否有明显过热或同质化风险。

UI 展示：

- 市场趋势摘要
- 竞品样例
- 热度分数
- 证据来源列表

### 7.2 Sourcing Agent

职责：

为候选商品寻找低价货源，并判断库存、供货稳定性和履约可行性。

输入字段：

- product_direction
- target_market
- expected_price_range
- max_fulfillment_days
- budget_range
- required_specs

工具 / 数据来源：

- 1688 / 拼多多 / 其他货源平台样例
- 供应商报价
- 库存信息
- 商品规格
- 包装尺寸和重量

输出字段：

- supplier_candidates
- source_price
- minimum_order_quantity
- available_stock
- estimated_fulfillment_time
- package_size
- package_weight
- supplier_reliability_score
- sourcing_risk

判断逻辑：

- 是否有足够价差。
- 是否有足够库存。
- 是否能在平台允许的履约周期内完成。
- 是否存在供应商不稳定、规格不一致、图片不真实等风险。

UI 展示：

- 货源候选列表
- 采购价
- 库存
- 预计履约时间
- 供应商风险提示

### 7.3 Margin Agent

职责：

判断商品从低价货源到 SEA marketplace 上架后的真实利润空间。

输入字段：

- source_price
- suggested_selling_price
- target_market
- platform
- package_weight
- package_size
- shipping_method
- platform_fee_rate
- estimated_return_rate
- estimated_loss_rate
- token_or_ai_operation_cost

输出字段：

- gross_margin
- net_margin
- cost_breakdown
- recommended_price
- minimum_viable_price
- margin_sensitivity
- profit_score

成本结构：

- 采购成本
- 国际运费
- 本地配送费用
- 关税 / GST / 税费
- 平台佣金
- 支付手续费
- 退货损耗
- 包装成本
- AI / token / 运营成本

判断逻辑：

- 如果净利润低于用户目标，标记为 Watch 或 Reject。
- 如果利润高但物流或退货风险高，交给 Committee Agent 权衡。
- 如果价格过高导致失去竞争力，降低推荐分数。

UI 展示：

- 成本瀑布图
- 建议售价
- 最低可行售价
- 利润敏感性

### 7.4 Risk & Compliance Agent

职责：

识别商品、平台、履约和内容层面的风险。

输入字段：

- product_name
- product_category
- product_images
- product_description
- target_market
- target_platform
- supplier_info
- fulfillment_time
- brand_info

检查维度：

- 禁售 / 限售商品
- 品牌和 IP 侵权
- 假货 / 仿品风险
- 电器认证和本地标准
- 标题 keyword spam
- 属性 spam
- 重复 listing
- 虚假折扣 / 价格 spam
- 图片与实物不一致
- 履约时间过长
- 售后和保修承诺不清晰

输出字段：

- risk_score
- risk_level
- violation_flags
- required_human_review
- compliance_recommendations
- blocked_reasons

判断逻辑：

- 高风险商品不进入自动上架包，只能进入人工 review。
- 中风险商品可以生成上架包，但必须在 UI 中展示 warning。
- 低风险商品可以进入 Go 推荐。

UI 展示：

- Compliance checklist
- Risk badge
- Human review required 标记
- 具体违规原因

参考：

- Shopee prohibited and restricted items policy: https://help.shopee.sg/portal/4/article/77151
- Shopee listing violation guide: https://cdngarenanow-a.akamaihd.net/shopee/seller/seller_cms/57eedfed7dfd35ddb5700002da951ac0/%5BSG%5D%20Listing%20Violations%20Guide.pdf
- Shopify dropshipping compliance: https://help.shopify.com/en/manual/compliance/legal/dropshipping

### 7.5 Listing Agent

职责：

把推荐商品转化成 Shopee / Lazada 可上架字段。

输入字段：

- selected_product
- target_platform
- target_market
- category
- recommended_price
- stock
- supplier_specs
- package_size
- package_weight
- risk_recommendations
- localization_style

Shopee 输出字段：

- item_name
- category_id
- brand
- condition
- description
- price
- stock
- sku
- variation
- attributes
- logistics
- package_weight
- package_dimensions
- images
- compliance_notes

Lazada 输出字段：

- PrimaryCategory
- Attributes
- Skus
- SellerSku
- price
- quantity
- special_price
- package_height
- package_length
- package_width
- package_weight
- package_content
- Images
- description

输出结果：

- shopee_listing_package
- lazada_listing_package
- editable_json
- copy_ready_fields
- missing_required_fields

判断逻辑：

- 不同平台字段不同，Listing Agent 需要把同一个商品转译成不同平台可用的结构。
- 如果缺少必填字段，不能标记为 ready。
- 如果 Risk Agent 有 warning，必须写入 listing package。

UI 展示：

- Shopee / Lazada tab
- 字段表格
- JSON preview
- Missing fields warning
- Copy / Export 按钮

参考：

- Lazada CreateProduct API: https://lazada-sellercenter.readme.io/docs/createproduct
- Lazada Open Platform product API docs: https://open.lazada.com/apps/doc/doc?docId=120949&nodeId=30720

### 7.6 Localization & Packaging Agent

职责：

生成适合目标市场的商品包装，包括标题、卖点、描述、图片风格、商品图 prompt、地区化场景和爆款逻辑。

输入字段：

- selected_product
- target_market
- platform
- competitor_examples
- local_language
- buyer_persona
- risk_constraints
- image_source
- product_specs
- source_product_images
- platform_image_rules
- local_context

输出字段：

- localized_title
- bullet_points
- product_description
- image_prompts
- hero_image_direction
- lifestyle_image_direction
- feature_image_direction
- regional_prompt_variants
- generated_image_candidates
- image_compliance_notes
- platform_style_notes
- localization_reasoning

包装逻辑：

- 学习竞品的标题结构、卖点顺序、图片构图和价格带。
- 根据市场做语言、本地生活场景和卖点适配。
- 对图片生成加入真实性约束，不制造商品不存在的功能。
- 避免夸大宣传和误导性承诺。
- 使用 OpenAI 图像生成 / 编辑能力生成商品图候选，包括主图、生活方式图和功能卖点图。
- 根据不同地区生成不同 prompt：例如 Singapore 强调 HDB / condo / compact living，Malaysia 可强调家庭场景和价格价值感。
- 保留 prompt、生成结果和审核备注，方便用户理解每张图为什么这样生成。
- 如果 source image 质量较差，先由 agent 生成清洁版商品图；如果缺少关键规格，则要求用户补充或标记为不可生成。

UI 展示：

- 标题和描述预览
- 图片 prompt
- 商品图预览
- 本地化说明
- 竞品风格参考
- 地区切换：Singapore / Malaysia / Philippines
- 图片版本选择：主图 / 场景图 / 卖点图
- 图片审核结果：真实属性一致 / 可能夸大 / 需要人工确认

可选技术路线：

- OpenAI image generation / image editing API：生成商品主图、生活方式图、卖点图。
- Vision model：从货源图中提取商品外观、规格和可见属性。
- Prompt template library：沉淀不同市场、平台和品类的图片 prompt。
- Retrieval / search：从竞品 listing 中提取标题结构、卖点顺序和图片风格。
- Rule-based validator：检查禁用词、夸大宣传、图片与规格不一致等问题。

### 7.7 Committee Agent

职责：

汇总所有 agent 的判断，给出最终推荐排序和决策解释。

输入字段：

- market_agent_output
- sourcing_agent_output
- margin_agent_output
- risk_agent_output
- listing_agent_output
- packaging_agent_output
- user_constraints

输出字段：

- ranked_opportunities
- decision
- decision_reason
- tradeoff_summary
- recommended_next_action
- confidence_score

决策标签：

- **Go**：利润、风险、履约和包装都可接受，建议进入上架包。
- **Watch**：有潜力，但存在库存、风险、利润或数据不足问题。
- **Reject**：利润不成立、风险过高、履约不可行或平台不适合。

判断逻辑：

- 利润高但风险高，不直接 Go。
- 热度高但货源不稳定，不直接 Go。
- 货源便宜但平台违规风险高，Reject。
- 数据不足但方向有潜力，Watch。

### 冲突决策逻辑

Committee Agent 的核心不是平均分，而是处理 agent 之间的 tradeoff：

| 冲突场景 | 示例 | 决策 |
| --- | --- | --- |
| 高热度 + 低利润 | 竞品很多、搜索热，但价格竞争激烈 | Watch，建议寻找更低货源或差异化包装 |
| 高利润 + 高风险 | 利润空间大，但疑似品牌/IP/安全风险 | Reject 或 Human Review |
| 低价货源 + 长履约 | 采购价低，但跨境到货时间过长 | Watch，要求更换供应商或调整发货承诺 |
| 好包装 + 弱需求 | 图片和文案很好，但市场信号不足 | Watch，不进入优先上架 |
| 字段完整 + 合规 warning | 上架包可生成，但存在关键词/类目/图片问题 | Human Review，不自动通过 |
| 中等利润 + 低风险 + 稳定货源 | 没有爆炸利润，但可持续测试 | Go |

推荐权重：

- Profit viability: 30%
- Market demand: 25%
- Compliance risk: 20%
- Fulfillment feasibility: 15%
- Packaging quality: 10%

硬性拦截：

- 禁售 / 限售商品。
- 明显品牌或 IP 侵权。
- 图片与商品实物不一致。
- 供应链无法满足平台履约承诺。
- 关键上架字段缺失。

UI 展示：

- Agent 投委会总结
- 每个 agent 的分数
- 冲突点
- 最终推荐理由

## 7.8 Demo 商品候选

Demo 商品建议聚焦 Shopee Singapore 上适合视觉展示、利润测算和本地化包装的轻量品类。不要选监管过重、品牌/IP 风险高、售后复杂或安全认证要求明显的商品。

推荐候选：

| 商品方向 | 推荐理由 | 需要规避 |
| --- | --- | --- |
| Mini desk vacuum / 桌面吸尘器 | 办公桌、学生宿舍、家庭清洁场景清晰，图像展示好看，价格带适合讲差价 | 避免夸大吸力、避免假品牌 |
| Portable dehumidifier / 小型除湿器 | 新加坡潮湿气候相关，Shopee 本地内容中有明确场景，适合讲本地化 | 注意电器安全、插头、功率和保修说明 |
| Cable organizer / 桌面线缆收纳 | 风险低、轻量、运费低、图像好看，适合多 SKU | 客单价低，利润故事没有小电强 |
| Pet grooming tool / 宠物清洁小工具 | 视觉好、生活方式强、适合本地化内容 | 避免医疗功效和夸大安全承诺 |
| Compact garment steamer / 手持挂烫机 | 场景清晰、图片好看、价格带可讲 | 电器安全和漏水/质量风险较高，需要 risk agent 拦截 |

当前最推荐 demo 主商品：

**Mini desk vacuum / 桌面吸尘器**

原因：

- 场景直观：办公桌、键盘、学生宿舍、小户型。
- 商品图容易生成和展示。
- 适合做 Shopee 标题、卖点、SKU 和图片本地化。
- 比大型电器监管和售后风险低。
- 可以自然展示 Margin Agent、Risk Agent 和 Packaging Agent 的价值。

## 8. 最终输出效果

Sea Launch AI 最终输出一个 **Commerce Launch Pack**，包含：

### 商品机会

- 商品名称
- 商品方向
- 目标市场
- 目标平台
- 推荐理由
- 市场需求信号
- 竞品参考

### 成本与利润

- 货源价格
- 建议售价
- 运费估算
- 关税 / 税费估算
- 平台费估算
- 退货和损耗估算
- 毛利
- 净利
- 利润率
- 最低可行售价

### 风险判断

- 平台风险
- 商品风险
- 品牌 / IP 风险
- 履约风险
- 图片和文案风险
- 是否需要人工 review

### 上架包

- Shopee listing package
- Lazada listing package
- 可复制 JSON
- 可编辑字段表格
- 缺失字段提醒
- 平台差异说明

### 本地化包装

- 商品标题
- 商品卖点
- 商品描述
- 图片 prompt
- 图片预览
- 本地化风格说明
- 爆款逻辑摘要

### ROI / 运营价值

- 人工调研耗时 vs agent 调研耗时
- 人工上架准备耗时 vs agent 生成耗时
- 风险拦截数量
- 推荐商品数量
- 可复用 skill / template

## 9. 商业模式

Sea Launch AI 更像一个 AI 运营外包团队，而不是单纯工具。它的收费可以分阶段设计：

### 阶段 1: SaaS 订阅

适合早期产品：

- 免费试用：每天生成少量商品机会。
- Pro 订阅：更多 agent run、更多商品机会、更多 listing package。
- Team 订阅：支持多人协作、历史记录、商品监控和模板库。

### 阶段 2: 按上架包收费

用户为具体结果付费：

- 每生成一个完整 Commerce Launch Pack 收费。
- 每个平台上架包单独计费。
- 图片生成和高级本地化作为增值项。

### 阶段 3: Performance-based Pricing

长期可以探索：

- 按成功上架商品数量收费。
- 按 GMV 或利润分成。
- 按持续监控和优化收费。

推荐 pitch 口径：

> 初期按 SaaS 和上架包收费，长期可以走 performance-based pricing，让 Sea Launch AI 和卖家的真实增长结果绑定。

## 10. 风险与边界

Sea Launch AI 需要主动处理以下边界：

- 不承诺商品一定产生销量。
- 不承诺用户一定赚钱。
- 不鼓励绕过平台规则。
- 不自动发布真实 listing，最终由用户确认。
- 不自动进行真实采购和支付，最终由用户确认。
- 不使用品牌侵权商品。
- 不生成和实物不一致的商品图片。
- 不生成 keyword spam、price spam 或重复 listing。
- 对高风险商品强制 human review。

推荐表达：

> Sea Launch AI lowers the cost of testing cross-border product opportunities, but final listing and business decisions remain under seller approval.

## 11. 明天 Pitch 主线

### 30 秒开场

轻资产卖家想进入东南亚电商市场，但他们不知道卖什么、哪里找货、利润怎么算、平台字段怎么填、图片和文案怎么本地化。原本这需要一个运营团队完成。Sea Launch AI 把这个团队变成 multi-agent system。

更强版本：

> A seller has an idea. Sea Launch AI turns it into a Shopee-ready business case in minutes: source, margin, risk, listing, and localized packaging.

中文版本：

> 一个卖家只需要给出商品方向，Sea Launch AI 就能在几分钟内生成一份 Shopee-ready 的商业判断：哪里进货、能不能赚钱、风险在哪里、怎么定价、怎么包装、怎么上架。

### 产品展示主线

1. 用户输入：目标市场 Singapore，平台 Shopee，商品方向 mini desk vacuum / 桌面吸尘器，预算和利润目标。
2. Agent War Room：Market、Sourcing、Margin、Risk、Listing、Packaging agents 分别分析。
3. Opportunity Board：系统推荐 3-5 个商品机会，并标记 Go / Watch / Reject。
4. Listing Studio：用户选择一个商品，系统生成 Shopee / Lazada 上架包。
5. ROI Dashboard：展示省下的人工时间、利润估算、风险拦截和可复用模板。

### 必须展示的赚钱逻辑

Pitch 里需要明确展示一张利润卡片：

- 货源价
- 建议售价
- 运费 / 税费 / 平台费 / 损耗
- 预计净利润
- 利润率
- 风险等级
- 为什么不是 guarantee，而是 estimated opportunity

推荐表达：

> The product is cool because it can find where money might be made, but trustworthy because it shows the assumptions before the seller acts.

### 评委视角的一句话

Sea Launch AI shows what ecommerce operations look like when AI is not an add-on, but the operating team itself.
