# 任务板 — Sea Launch AI

> 多电脑 / 多 agent 协作。**认领用 GitHub Issues**(`gh issue list` → 自分配 → 开分支 → PR)。
> 本文件是人读的总览;状态以 Issues 为准。开工流程见 [CLAUDE.md](../CLAUDE.md#多电脑--多-agent-任务领取流程)。

## 角色

| 代号 | 角色 | 主线 |
|---|---|---|
| P1 | AI / Backend | agent 管道 + 利润/风险逻辑 + `/api/run` |
| P2 | Frontend 主力 | Seller Brief + Agent War Room |
| P3 | Frontend / Data | Opportunity Board + Listing Studio + 种子数据 |
| P4 | Product / Pitch | demo 脚本 + slides + QA + 录屏 |

## 依赖关系

```
TASK-01 骨架 ──┬─▶ TASK-02 Brief ──▶ TASK-03 War Room
               ├─▶ TASK-04 Opportunity Board
               ├─▶ TASK-05 Listing Studio
               └─▶ TASK-06 /api/run(mock) ──▶ TASK-07 真实 agent 管道
TASK-08 种子数据(独立,尽早)
TASK-09 pitch(独立,后期)
```
> contract 已就位,**TASK-02/03/04/05 可对着 `contract/mock-result.json` 立即并行,不等后端。**

---

## TASK-01 · Next.js 骨架 · P1/P2
- 建 Next.js 14 (App Router) + TS + Tailwind,4 个页面路由占位 + `lib/openai.ts` + `.env.example`。
- `app/api/run/route.ts` 先实现 `?mock=1` 返回 `contract/mock-result.json`。
- **验收**:`npm run dev` 起得来;访问 4 个路由不报错;`/api/run?mock=1` 返回完整 JSON。

## TASK-02 · Seller Brief 页 · P2
- 表单产出 `Brief`(见 `contract/result.ts`),提交后调 `/api/run` 跳 War Room。
- **验收**:能填完整 brief 并触发一次 run(先打 `?mock=1`)。

## TASK-03 · Agent War Room 页 · P2
- 渲染 `agents[]`:6 个 agent 卡片,status 渐进点亮、evidence、score、confidence、warnings。
- 允许展示 agent 间冲突(利润高/风险高),最后 Committee 汇总。
- **验收**:对着 mock 能播放出"逐个 agent 完成"的过程,看得到证据和分数。

## TASK-04 · Opportunity Board 页 · P3
- 渲染 `opportunities[]`:3 张卡 + Go/Watch/Reject badge + 风险等级。
- 主卡(`is_primary`)展示 **利润瀑布图**(`margin.cost_breakdown`)+ low/base/high。
- 展示 `committee`(排序 + tradeoff)。默认按 overall 排序,**高风险不得因利润高排到最前**。
- **验收**:一眼看懂哪个值得测;利润卡数字与 mock 一致;点主卡可进 Listing Studio。

## TASK-05 · Listing Studio 页 · P3
- 渲染 `selected_listing`:Shopee 字段表格(可编辑)、bullet points、3 张图分组、
  compliance 警告、missing fields、JSON 复制按钮。
- **验收**:字段完整可复制;compliance 警告醒目;图片分 hero/lifestyle/feature。

## TASK-06 · /api/run mock 接线 · P1
- `POST /api/run` 接收 `Brief`,默认也先返回 mock(结构 = `RunResult`),供前端联调。
- **验收**:前端把 mock import 换成 fetch `/api/run`,**零改动**正常渲染。

## TASK-07 · 真实 agent 管道 · P1
- 实现 `lib/agents/{market,sourcing,margin,risk,listing,committee}.ts`,见 [AGENTS.md](AGENTS.md)。
- 每个 agent 用 Responses API + strict json_schema;Market/Sourcing 用 Function Calling 读 `seed/`。
- **验收**:`/api/run`(非 mock)真实跑出结果且**通过 `contract/result.schema.json` 校验**;
  吸尘器 primary 决策 = Watch、Risk 含电器/夸大 warning。

## TASK-08 · 种子真实数据 · P3
- 手抓吸尘器:8–10 条真实 Shopee SG listing(标题/价/评论/评分)+ 3–4 个 1688 报价 → `seed/desk-vacuum.json`。
- Shopee 禁售/违规规则摘要 → `seed/shopee-rules.json`。预生成 3 张图 → `seed/images/`。
- **验收**:`seed/` 数据可被 Market/Sourcing/Risk 的 Function 读取。

## TASK-09 · Pitch + Demo 兜底 · P4
- 3 分钟脚本(问题→方案→demo→市场)、slides(含 roadmap 砍掉项)、录屏兜底、彩排 ≥2 遍。
- **验收**:讲稿定稿;录屏覆盖完整 happy path;计时 ≤3 分钟。
