# TASK-FE · 前端(独立整轨,一个同学拥有)

> **完全对着 `contract/mock-result.json` 开发,不依赖后端,不卡别人、别人不卡你。**
> 唯一依赖:TASK-01 骨架。一个同学端到端拥有,内部用 **4 路 subagent 扇出**(一页一个)。

## 独占路径
`app/brief/**` `app/war-room/**` `app/board/**` `app/studio/**`
`components/**`(公共件 `components/ui/` 谁先建谁占,内部协调)

## 公共约定
- 类型从 `contract/result.ts` import,**不要自己重定义**。
- 先 `import mock from "@/contract/mock-result.json"` 渲染;后端 ready 后改 `fetch('/api/run')`,
  结构一致,零返工。
- 图表(利润瀑布)可用轻量库或纯 div,别为依赖卡时间。

## Subagent 扇出(4 页可并行,各占各目录)

### □ 页面 1 · Seller Brief (`app/brief`)
- 表单产出 `Brief`(见 `result.ts`):市场/平台/卖家类型/商品方向/品类/预算/利润目标/履约天数/风险偏好/语言。
- 提交 → 调 `/api/run`(先打 `?mock=1`)→ 跳 `/war-room`。
- 验收:1–2 分钟能填完;输入结构化,不是开放式 prompt。

### □ 页面 2 · Agent War Room (`app/war-room`)
- 渲染 `agents[]`:7 张 agent 卡片(market→sourcing→margin→risk→listing→packaging→committee),**status 渐进点亮**(waiting→running→done)。
- 可加一个 audit 链接占位(`audit_run_id` → 未来 `/api/runs/:id/audit`),MVP 可不实现详情页。
- 每卡展示:role、data_sources、evidence[]、key_judgment、score、confidence、warnings。
- 允许展示冲突(利润高/风险高),Committee 卡做最终汇总。
- 验收:看得到"逐个 agent 完成"的过程 + 证据 + 分数,不是只显示 thinking。

### □ 页面 3 · Opportunity Board (`app/board`)
- 渲染 `opportunities[]`:3 张卡 + Go/Watch/Reject badge + 风险等级。
- 主卡(`is_primary`):**利润瀑布图**(`margin.cost_breakdown`)+ low/base/high 三档。
- 渲染 `committee`(排序 + tradeoff)。默认 overall 排序,**高风险不得因利润高排最前**。
- 点主卡 → 进 `/studio`。
- 验收:一眼看懂哪个值得测;利润数字与 mock 一致。

### □ 页面 4 · Listing Studio (`app/studio`)
- 渲染 `selected_listing`:Shopee 字段表格(可编辑)、bullet points、3 张图分组
  (hero/lifestyle/feature)、compliance 警告、missing fields、复制 JSON 按钮。
- 验收:字段完整可复制;compliance 警告醒目。

## 整轨验收
4 页串起来能走完 demo 主线:Brief →(run)→ War Room → Board → 选吸尘器 → Listing Studio,
全程基于 mock,流畅无报错。
