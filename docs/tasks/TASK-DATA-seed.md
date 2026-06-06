# TASK-DATA · 种子真实数据(独立轨,可立刻开工)

> 纯数据文件,**不依赖骨架、不依赖任何人,最先能动手**。后端的 Market/Sourcing/Risk 读它。

## 独占路径
`seed/**`

## Subagent / 子任务(seed 布局见 [ROADMAP §3](../IMPLEMENTATION-ROADMAP.md))

### □ market 信号
- `seed/market/mini-desk-vacuum-shopee-search.json` — Shopee SG 搜 "mini desk vacuum",**抄 8–10 条真实 listing**(标题/价格 SGD/评论数/评分/销量标签)。
- `seed/market/mini-desk-vacuum-competitor-details.json` — top 3 竞品详情(主图风格、卖点结构、属性)。

### □ sourcing 报价
- `seed/sourcing/mini-desk-vacuum-1688-offers.json` — 1688 **抄 3–4 个真实报价**(price RMB/MOQ/发货地/规格/包装重量+尺寸/offer id)。

### □ rules 合规
- `seed/rules/shopee-sg-policy-rules.json` — Shopee SG 禁售/限售规则(给 Risk,每条带 rule id)。
- `seed/rules/shopee-sg-listing-violations.json` — listing 违规规则(电器/夸大/keyword spam/图文不符)。

### □ shipping / fx
- `seed/shipping/cn-to-sg-small-parcel.json` — CN→SG 小包运费(low/base/high + 天数 + 假设)。
- `seed/fx/cny-sgd.json` — CNY→SGD 汇率(rate + captured_at + source)。

### □ images 源图
- `seed/images/source-product/mini-desk-vacuum-source.png` — 一张真实/参考源图,供 Packaging 的 image edit 用。
- 注:最终 hero/lifestyle/feature 由 Packaging **live 生成**写到 `public/generated/<run_id>/`,不放 seed。

## 验收
- 上述 JSON 均合法且字段齐(带 source / captured_at / id 元数据,见 [ROADMAP §6](../IMPLEMENTATION-ROADMAP.md))。
- provider 适配器(`lib/providers/*`)能直接读对应 seed 文件做 fixture 回放。
