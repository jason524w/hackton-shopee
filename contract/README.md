# Contract — Sea Launch AI

这是前后端的**唯一对齐目标**。

## 文件

| 文件 | 用途 | 谁用 |
|---|---|---|
| `result.ts` | TypeScript 类型(**规范来源 canonical**) | 前端 `import type { RunResult } from "contract/result"` |
| `result.schema.json` | JSON Schema | **后端 `/api/run` 输出必须能通过校验** |
| `fixtures/sample-result.json` | 一份符合 schema 的样例结果 | **只给测试用**(schema 回归 + UI 单测);禁止运行时 import |

## 约定

- 后端接口:`POST /api/run`,body = `Brief`,返回 `RunResult`。**live 管道是唯一路径**,无 mock 参数。
- 前端直接 fetch `/api/run` 渲染所有页面;视图模型映射集中在 `frontend/src/lib/adapters.ts`。
- 改 schema 必须三处同步改:`result.ts` + `result.schema.json` + `fixtures/sample-result.json`,并在群里吼一声。
- 改完跑 `node scripts/check-contract.mjs`(零依赖)验证 fixture 仍符合 schema —— 防漂移(CI 也会跑)。

## 页面 → 字段映射

- **Seller Brief** → 产出 `brief`
- **Agent War Room / Org Room** → 渲染 `agents[]`(status + evidence + score)
- **Opportunity Board** → 渲染 `opportunities[]`(主卡 `is_primary` 带 `margin` 利润瀑布) + `committee`
- **Listing Studio** → 渲染 `selected_listing`(Shopee 字段 + images + compliance 警告)
