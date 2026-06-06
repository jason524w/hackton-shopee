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
 → Listing     消费 canonical score + 工具筛选 + Packaging handoff
 → Packaging   生成 Shopee-ready 文案/字段 + 本地化图片       selected_listing
 → Committee   汇总 + tradeoff + Go/Watch/Reject 排序        committee + decisions
```

**性能取舍:** Market 产 3 候选;Listing Ranker 不覆盖 Market 的 `is_primary`,也不替代
Committee 的最终排序。它消费上游 canonical scores,用工具证据做筛选/解释,但**只有
handoff 候选进入 Packaging 深管道**;另外候选保留轻量分数与筛选理由。控制延迟与 token。

**接线约束:** Listing handoff 不是 Listing Studio 最终交付物。`/api/run` 接 live pipeline
时必须 Listing → Packaging 成对接线,由 Packaging 写最终 copy/images/ready 状态后再返回给前端。

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

> ⚠️ **#14 实现为 pure-A**:**LLM 定 Go/Watch/Reject**,以上加权/硬拦截降级为**证据 + 失败兜底**;
> "高风险不能 Go" 是软约束(skill + eval,非代码硬闸)。权威见 [design/committee.md](design/committee.md)。

硬性拦截(直接 Reject / Human Review):禁售限售、品牌IP侵权、图文不符、
履约无法满足平台承诺、关键字段缺失。

冲突 tradeoff 示例:
| 冲突 | 决策 |
|---|---|
| 高需求 + 中合规风险 + 利润敏感 | Watch(小批量测试、规避夸大) |
| 高利润 + 高合规风险 + 长履约 | Reject |
| 低风险 + 稳定货源 + 中等利润 | Go |

## 失败处理(取代旧的 demo mode)

`/api/run` 只有 live 一条路径:无 `OPENAI_API_KEY` → 503 `not_configured`;
管道失败 → 500 + `audit_run_id`(可查 `/api/runs/:id/audit` 定位哪个 agent 挂了);
输出不过 schema → 500 `contract_violation` + 错误明细。前端渲染对应失败态,不静默降级。

## 技术决策记录

- **为什么 Next.js 单仓**:4 人 1 天,前端 + API routes 同仓,省去前后端联调与部署。
- **为什么不上 agent 框架**:6 个串行结构化调用,手写更可控、更好 debug。
- **为什么 contract-first**:让前端零依赖后端并行开发,这是 hackathon 最大提速点。
- **为什么去掉 mock 路径**:demo 期结束后双路径导致前端渲染逻辑与真实输出漂移、
  契约校验形同虚设;单一路径让 schema 校验在每次真实运行中生效(见 REFACTOR.md)。
- **为什么砍 Lazada / 多地区 / ROI 代码**:见 [MVP-SCOPE.md](MVP-SCOPE.md)。
