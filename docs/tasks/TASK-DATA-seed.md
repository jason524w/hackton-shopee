# TASK-DATA · 种子真实数据(独立轨,可立刻开工)

> 纯数据文件,**不依赖骨架、不依赖任何人,最先能动手**。后端的 Market/Sourcing/Risk 读它。

## 独占路径
`seed/**`

## Subagent / 子任务

### □ `seed/desk-vacuum.json` — 真实市场 + 货源
- 打开 Shopee SG 搜 "mini desk vacuum",**手抄 8–10 条真实 listing**:
  标题、价格(SGD)、评论数、评分、是否有销量标签。
- 1688 搜对应商品,**抄 3–4 个真实报价**:价格(RMB)、MOQ、发货地、规格、包装重量。
- 结构参考 `contract/mock-result.json` 里 market/sourcing 的 evidence 字段。

### □ `seed/shopee-rules.json` — 合规规则摘要
- 从 Shopee 禁售/限售 + listing violation 指南里抄关键规则(电器、夸大宣传、keyword spam、
  品牌/IP、图文不符)。给 Risk agent 当判断依据。
- 参考链接见 `docs/PRD.md` 第 7.4 / 第 4 层。

### □ `seed/images/` — demo 预生成图(3 张)
- 用 OpenAI 图像生成,提前做好:`desk-vacuum-hero.png` `-lifestyle.png` `-feature.png`。
- prompt 参考 `mock-result.json` 的 `selected_listing.images[].prompt`。
- **demo 不 live 生成图,用这三张静态图。**

## 验收
- 三个产物就位;`seed/desk-vacuum.json` 和 `seed/shopee-rules.json` 是合法 JSON。
- 后端 Function(search_shopee / get_1688_quotes)能直接读 `desk-vacuum.json`。
- Listing Studio 的 `images[].url` 能指到 `seed/images/` 里真实存在的图。
