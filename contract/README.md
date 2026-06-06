# Contract — Sea Launch AI

这是前后端的**唯一对齐目标**。Hour 0 就锁定,四个人对着它并行开工。

## 文件

| 文件 | 用途 | 谁用 |
|---|---|---|
| `mock-result.json` | 一份完整的假结果(吸尘器 demo) | **前端对着它开发**,不用等后端 |
| `result.ts` | TypeScript 类型 | 前端 `import { RunResult } from "@/contract/result"` |
| `result.schema.json` | JSON Schema | **后端 `/api/run` 输出必须能通过校验** |

## 约定

- 后端接口:`POST /api/run`,body = `Brief`,返回 `RunResult`。
- 前端先 `import mock from "@/contract/mock-result.json"` 渲染所有页面;后端 ready 后改成 fetch `/api/run`,**结构完全一致,零返工**。
- 改 schema 必须三处同步改:`mock-result.json` + `result.ts` + `result.schema.json`,并在群里吼一声。

## demo mode

- `/api/run` 支持 `?mock=1` → 直接回 `mock-result.json`(现场兜底,零延迟、零失败)。
- 真实跑通后把输出存成新的缓存 JSON,demo 默认走缓存,真跑当备份。

## 页面 → 字段映射

- **Seller Brief** → 产出 `brief`
- **Agent War Room** → 渲染 `agents[]`(status 渐进点亮 + evidence + score)
- **Opportunity Board** → 渲染 `opportunities[]`(主卡 `is_primary` 带 `margin` 利润瀑布) + `committee`
- **Listing Studio** → 渲染 `selected_listing`(Shopee 字段 + images + compliance 警告)
