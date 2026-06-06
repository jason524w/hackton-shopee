# MVP 范围 — 24h

只为 **「Mini Desk Vacuum · Shopee · Singapore」** 做一条端到端跑通的主线。

## ✅ 做

| 模块 | 说明 |
|---|---|
| Seller Brief | 单页表单,产出 `brief` |
| Agent War Room | 渲染 6 个 agent,status 渐进点亮 + evidence + score |
| Opportunity Board | 3 张候选卡 + 主卡利润瀑布 + Committee 排序/tradeoff |
| Listing Studio | Shopee 一份 listing + 预生成图 + compliance 警告 |
| `/api/run` 真实 7-agent 管道 + live 图 | **主 demo 路径**,输出符合 schema,详见 [IMPLEMENTATION-ROADMAP](IMPLEMENTATION-ROADMAP.md) |
| `/api/run?mock=1` + 缓存 | **必达安全网**:零延迟零失败,live 失败一键切回;**永不移除** |
| `/api/run?images=0` | 纯文本快速彩排 |
| seed 真实数据 | 吸尘器的 Shopee + 1688 种子数据 |
| 后端 7-agent + runtime/audit/providers | 按 [IMPLEMENTATION-ROADMAP](IMPLEMENTATION-ROADMAP.md) 完整建(团队已选完整路线) |

> 后端范围以 **IMPLEMENTATION-ROADMAP.md 为权威**;下面的 ❌ 主要是**前端 / 演示层**的取舍。

## ❌ 不做(进 roadmap slide,嘴上讲)

| 砍掉 | 原因 |
|---|---|
| Lazada 双平台字段 | 工程量翻倍,评委加分有限 |

> 注:`contract` 里保留 `"Lazada"` 作为 **future-compat 字段**,但 **MVP UI 固定 Shopee**,
> 不实现 Lazada 渲染/转译。Lazada 只在 pitch 的 roadmap 里讲。
| 多地区 SG/MY/PH 本地化变体 | 一个市场足够讲清本地化逻辑 |
| ROI Dashboard 写代码 | 改成 1 张静态 slide |
| 监控闭环 / 订阅付费系统 | 纯 pitch 内容 |
| 用户登录 / 多用户 / 持久化 | demo 不需要 |
| 3–5 候选全部走深管道 | 只有 primary 候选走完整,其余轻量 |

## 砍/不砍的判断标准

**"它服务 demo 高潮吗?"**(Risk 弹电器风险 → 利润卡敏感 → Committee 给 Watch)
- 服务 → 做
- 不服务 → 砍

## 时间节奏

- **Hour 0–3**:锁 contract(已完成)、建 Next.js 骨架、抓种子数据、分工领 Issue。
- **Hour 3–18**:管道跑通 + UI 接好。**目标 Hour ~12 前 happy path 端到端跑通一次**。
- **Hour 18–24**:冻结功能,做 demo 缓存 + 录屏,彩排 pitch ≥2 遍。

## 红线

1. happy path 优先于任何新功能;Hour 12 没通就再砍。
2. demo 走缓存,不 live 调 6 次 + 图像生成。
3. 利润卡 + Risk 拦截是 pitch 高潮,务必打磨。
