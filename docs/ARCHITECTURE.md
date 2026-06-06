# 架构 — Sea Launch AI

## 总览

单仓单应用(Next.js)。一次用户运行 = 一次 `POST /api/run`,后端按顺序跑 6 个 agent,
把全部结果拼成一个 `RunResult` 返回,前端 4 个页面渲染同一个对象的不同切片。

```
┌──────────────┐   POST /api/run (Brief)   ┌─────────────────────────────┐
│  Next.js UI  │ ────────────────────────▶ │  /api/run  (Edge/Node route) │
│  4 pages     │ ◀──────────────────────── │  → agent pipeline → RunResult│
└──────────────┘      RunResult JSON        └─────────────────────────────┘
                                                      │
                                                      ▼
                                       lib/agents/*  +  seed/*  +  OpenAI
```

## Agent 管道(串行)

```
Brief
 → Market      产 3 候选 + demand 信号                     directions[]
 → Sourcing    只对 primary 候选,读 1688 种子报价           supplier/price/stock
 → Margin      套利润公式,出 low/base/high + cost 瀑布      margin detail
 → Risk        对照 Shopee 禁售/违规规则打分                 flags / risk_level
 → Listing     工具驱动粗排/精排 + 筛选 + Packaging handoff
 → Packaging   生成 Shopee-ready 文案/字段 + 本地化图片       selected_listing
 → Committee   汇总 + tradeoff + Go/Watch/Reject 排序        committee + decisions
```

**性能取舍:** Market 产 3 候选;Listing Ranker 用工具证据做粗排/精排,但**只有 handoff
候选进入 Packaging 深管道**;另外候选保留轻量分数与筛选理由。控制延迟与 token。

**每个 agent = 一次 Responses API 调用**,`response_format: json_schema (strict)`。
单个 agent 可有内部 schema(例如 Listing Ranker 的 `ranked_ids` / factor scores / filters);
最终只由 `/api/run` 汇总出的 `RunResult` 对齐 `contract/`。需要"查数据"的 agent 用
Function Calling 调 `seed/` 里的 provider。

agent 详细输入/输出/prompt 意图见 [AGENTS.md](AGENTS.md)。

## 数据策略

- **不实时爬 Shopee / 1688**(验证码 + rate limit + 一天做不完)。
- demo 前**手抓真实数据烤进 `seed/`**:吸尘器的 8–10 条真实 Shopee SG listing +
  3–4 个 1688 报价。Market/Sourcing 的 Function 读这些种子 → "基于真实数据"站得住。
- 市场热度可用 Web Search API 兜底,非必需。

## 利润模型(护城河,务必做实)

```
net_profit = selling_price
  − source_price − intl_shipping − local_delivery
  − platform_fee − payment_fee − gst
  − return_reserve − damage_reserve − packaging − ai_ops
net_margin = net_profit / selling_price
```
- 退货率/损耗率按品类设默认值,可调。
- 运费/税费做区间 → UI 出 **low / base / high 三档** + cost 瀑布图。
- 利润只在乐观档成立 → Committee 给 **Watch**,不给 Go。

## Committee 决策

权重:profit 30% · demand 25% · compliance 20% · fulfillment 15% · packaging 10%。

硬性拦截(直接 Reject / Human Review):禁售限售、品牌IP侵权、图文不符、
履约无法满足平台承诺、关键字段缺失。

冲突 tradeoff 示例:
| 冲突 | 决策 |
|---|---|
| 高需求 + 中合规风险 + 利润敏感 | Watch(小批量测试、规避夸大) |
| 高利润 + 高合规风险 + 长履约 | Reject |
| 低风险 + 稳定货源 + 中等利润 | Go |

## Demo mode

`/api/run?mock=1` 直接返回 `contract/mock-result.json`。真实跑通后把输出存成缓存,
demo 默认走缓存路径,真跑当备份 + 准备录屏兜底。

## 技术决策记录

- **为什么 Next.js 单仓**:4 人 1 天,前端 + API routes 同仓,省去前后端联调与部署。
- **为什么不上 agent 框架**:6 个串行结构化调用,手写更可控、更好 debug。
- **为什么 contract-first**:让前端零依赖后端并行开发,这是 hackathon 最大提速点。
- **为什么砍 Lazada / 多地区 / ROI 代码**:见 [MVP-SCOPE.md](MVP-SCOPE.md)。
