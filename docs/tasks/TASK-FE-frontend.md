# TASK-FE · 前端(独立整轨,一个同学拥有)

> 前端是 `frontend/` 下的独立 Next 16 / React 19 应用,对着 `contract/result.ts` 开发。
> 一个同学端到端拥有,内部用 **4 路 subagent 扇出**(一页一个)。

## 实际路径(frontend/ 下)
`frontend/src/app/app/brief/**` `frontend/src/app/app/org-room/**`(原 war-room)
`frontend/src/app/app/board/**` `frontend/src/app/app/studio/**`
`frontend/src/components/**`

## 公共约定
- 类型从 `contract/result.ts` import,**不要自己重定义**(铁律 1)。
- **单一真实路径(铁律 3):只走 live `POST /api/run`,没有 mock。** 没有 `?mock=1`、
  没有 `mock-data.ts`;run 前页面渲染空/加载态。彩排用 `?images=0` 跑纯文本快通道。
- `RunResult` 进 `frontend/src/lib/store.ts`(zustand),`adapters.ts` 映射成视图模型,各页从 store 读。
- 图表(利润瀑布)可用轻量库或纯 div,别为依赖卡时间。

## Subagent 扇出(4 页可并行,各占各目录)

### □ 页面 1 · Seller Brief (`app/brief`)
- 表单产出 `Brief`(见 `result.ts`):市场/平台/卖家类型/商品方向/品类/预算/利润目标/履约天数/风险偏好/语言。
- 提交 → 调 live `POST /api/run`(彩排用 `?images=0`)→ 跳 `/app/org-room`。run 进行中按钮禁用,防双击双跑。
- 验收:1–2 分钟能填完;输入结构化,不是开放式 prompt。

### □ 页面 2 · Agent War Room (`app/org-room`)
- 渲染 `agents[]`:7 张 agent 卡片(market→sourcing→margin→risk→listing→packaging→committee),**status 渐进点亮**(waiting→running→done)。
- 可加一个 audit 链接占位(`audit_run_id` → 未来 `/api/runs/:id/audit`),MVP 可不实现详情页。
- 每卡展示:role、data_sources、evidence[]、key_judgment、score、confidence、warnings。
- 允许展示冲突(利润高/风险高),Committee 卡做最终汇总。
- 验收:看得到"逐个 agent 完成"的过程 + 证据 + 分数,不是只显示 thinking。

### □ 页面 3 · Opportunity Board (`app/board`)
- 渲染 `opportunities[]`:3 张卡 + Go/Watch/Reject badge + 风险等级。
- 主卡(`is_primary`):**利润瀑布图**(`margin.cost_breakdown`)+ low/base/high 三档。
- 渲染 `committee`(排序 + tradeoff)。默认 overall 排序,**高风险不得因利润高排最前**。
- 点主卡 → 进 `/app/studio`。
- 验收:一眼看懂哪个值得测;利润数字与 live `RunResult` 一致。

### □ 页面 4 · Listing Studio (`app/studio`)
- 渲染 `selected_listing`:Shopee 字段表格(可编辑)、bullet points、3 张图分组
  (hero/lifestyle/feature)、compliance 警告、missing fields、复制 JSON 按钮。
- 验收:字段完整可复制;compliance 警告醒目。

## 整轨验收
4 页串起来能走完 demo 主线:Brief →(live run)→ War Room(org-room)→ Board → 选吸尘器 → Listing Studio,
全程基于真实 `RunResult`,流畅无报错。
