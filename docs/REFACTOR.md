# 去 Mock 重构方案 v2 — 基于 origin/main 真实代码

> 状态:**✅ 已执行完毕**(PR #51 重构 + PR #52 live bug 修复,2026-06-07 合入 main)。
> 本文保留作架构决策记录;当前待办见 [NEXT-STEPS.md](NEXT-STEPS.md)。
> 执行结果:live 管道端到端 HTTP 200,7 agent 全过,demo 高潮(吸尘器=Watch)真实复现。

## 0. 仓库真实现状

**后端(已大体建成)**
- `lib/agent-runtime/`:run-agent(`AgentRunMode = "fixture" | "live" | "mock"`)、audit、replay、schemas、tool-runner。
- `lib/agents/`:7 个 agent(market / sourcing / margin / risk / listing / packaging / committee),各带 harness、schema、skill、tools、tests。
- `lib/providers/`:adapter 层 — shopee、sourcing-1688、fx 为 seed 实现;shipping 有 easyship live、browser-retrieval 有 chrome live、openai-image 有 live。
- `app/api/run/route.ts`(main):**只有 mock 路径**(`?mock=1` / `DEMO_MOCK_ONLY`),live 返回 501。
- CI:`scripts/check-contract.mjs` + `contract-check.yml` 校验 mock-result.json 过 schema。

**前端(完全 mock 驱动 — 重构最大头)**
- `frontend/`:完整 Next 应用(营销页 + 9 个 app 页面),但 **零次调用 `/api/run`**。
- `frontend/src/lib/mock-data.ts`:**952 行**假数据;`store.ts` 的 `startRun()` 只是把 mock 常量塞进 zustand。
- `frontend/src/lib/types.ts`:自定义一套类型(SellerBrief/DepartmentResult…),**与 `contract/result.ts` 脱钩,违反铁律 1**。

**其他 mock 资产**
- `mock/`:独立静态 demo workspace(html/js/svg),自称"不碰主项目"。
- `contract/mock-result.json`:282 行,被 route.ts 运行时读取 + CI 校验。

**未合并分支(5 个)**

| 分支 | 增量 | 判断 |
|---|---|---|
| `codex/live-api-orchestrator` (+2, 0 behind) | orchestrate.ts + validate-run-result.ts + route 接 live 管道;有 `?mode=fixture`、`LIVE_IMAGE_GENERATION` | **live 管道的最新版,重构基底** |
| `task-15-api-integration` (+8, 11 behind) | 同一套 orchestrator 的旧版,但多 5 个测试文件(orchestrate/validate/audit-root/run-id/image-mode) | 与上面**重复**;只摘测试,关分支 |
| `dev` (+1) | 在仓库根又建了第二套 UI(`app/*` + 811 行 demo-workspace.tsx)+ 旧版 orchestrate | 第二套 mock UI,**建议放弃** |
| `codex/task-4-seed-data` (+1) | seed JSON 加厚 +914 行 | 与 mock 无关,**值得独立合并** |
| `codex/docs-three-main-docs` (+1) | 文档合并(TASKS.md +520,删 docs/tasks/*) | 文档治理,单独评审 |

其余 24 个分支已全部合进 main,可批量删除。

## 1. Mock 分类(决定删什么、留什么)

| 类 | 位置 | 处置 |
|---|---|---|
| A. 静态 mock 返回 | `?mock=1`、`DEMO_MOCK_ONLY`、route 读 mock-result.json | **删** |
| B. 运行时 mock/fixture 模式 | `AgentRunMode` 的 `"mock"`、`"fixture"`;无 key 时静默 fixture 回退 | **运行时删**;fixture 注入只许出现在测试 |
| C. 前端 mock 数据层 | mock-data.ts(952 行)+ 脱钩的 types.ts | **重写为真实 API 接入**,mock 数据降级为测试 fixture |
| D. 独立 mock workspace | `mock/` 目录 | **整目录删** |
| E. 测试内 mock/fixture | `__tests__/**` | **保留**(正当测试手段) |
| F. seed providers | `seed/` + seed provider 实现 | **保留** — seed 是既定数据策略(不实时爬),不算 mock;但 live provider(easyship/chrome/openai-image)应成为默认,seed 作为显式配置 |

## 2. 重构步骤(按依赖排序)

### Step 1 · 合并 live 管道(先有真路径,再删假路径)
1. 以 `codex/live-api-orchestrator` 为基底合入 main。
2. 从 `task-15-api-integration` cherry-pick 5 个测试文件(两分支 orchestrate/route 高度重叠,以基底版为准),然后关闭 task-15 和 dev 的 orchestrator 部分。
3. 合并 `codex/task-4-seed-data`(独立增益)。

### Step 2 · 删 API 层 mock
`app/api/run/route.ts`:
- 删 `?mock=1`、`DEMO_MOCK_ONLY`、`?mode=fixture` 与 mock-result.json 读取。
- **删静默 fixture 回退**:无 `OPENAI_API_KEY` 时不再假装 live 返回 seed 数据,改为返回
  `503 { status: "not_configured", message: "OPENAI_API_KEY required" }` —— 当前行为(没 key 也返回"成功")会让假数据冒充真结果,是最危险的一类 mock。
- 错误响应里的 hint("fall back to ?mock=1")同步删除。

### Step 3 · 收紧 agent runtime
- `AgentRunMode` 从 `"fixture" | "live" | "mock"` 收为 `"live"`;
  fixture/mock 注入改为测试侧通过 `RunAgentOptions.client` / `providers` 传 stub 实现(接缝已存在,改动小)。
- `orchestrate.ts` 删 `textMode`/`imageMode` 的 fixture/dry-run 运行时分支;`createSeedProviders()` 移入测试 helpers。
- 全量跑 `lib/**/__tests__`,fixture 相关用例改从测试侧注入。

### Step 4 · 前端接真实 API(工作量最大)
1. 删 `frontend/src/lib/types.ts` 的重复类型,改 import `contract/result.ts`(回归铁律 1)。
2. `store.ts`:`startRun()` 改为 `POST /api/run`(传 Brief),用返回的 `RunResult` 填充
   departments/opportunities/listing;增加 loading / error 态(管道 30–90s,需进度 UI,可先轮询 `/api/runs/[id]/audit`,后续升级 SSE)。
3. `mock-data.ts` 952 行:砍到只剩组件测试需要的最小 fixture,移到 `frontend/src/lib/__fixtures__/`,**禁止页面代码 import**。
4. 9 个 app 页面逐页把 mock 字段映射改为 RunResult 字段映射(命名差异:DepartmentResult ↔ AgentResult 等)。

### Step 5 · 清理静态资产与 contract
- `git rm -r mock/`。
- `git mv contract/mock-result.json contract/fixtures/sample-result.json`;
  `scripts/check-contract.mjs` 改路径 —— CI 的 schema 回归**保留**(这是好资产)。
- `app/api/run/default-brief.ts` 的 DEFAULT_BRIEF 保留(空 body 兜底是可用性,不是 mock)。

### Step 6 · 文档同步(8 处)
- `CLAUDE.md` 铁律 3 整条替换:"~~Live 主路径 + mock 永不可移除安全网~~" → "**单一 live 路径;fixture 只许出现在测试;运行时 import fixtures 的 PR 一律打回**";仓库结构注释同步。
- `contract/README.md`(5 处)、`docs/ARCHITECTURE.md`(demo mode 节)、`docs/IMPLEMENTATION-ROADMAP.md`(**19 处**,重灾区)、`docs/TASKS.md`、`docs/AGENTS.md`、`docs/MVP-SCOPE.md`、`CONTRIBUTING.md` 按 grep 清单逐处改。
- 验收:`git grep -i mock -- ':!*__tests__*' ':!*__fixtures__*' ':!*fixtures*' ':!*-lock.json'` 仅命中本文件。

### Step 7 · 分支大扫除
- 删 24 个已合并分支;`docs-three-main-docs` 单独评审后合并或关闭。

## 3. Code Review 要点(合并 live 管道前必须处理)

| # | 文件 | 问题 | 级别 |
|---|---|---|---|
| 1 | route.ts(两个 live 分支) | 无 key 时静默 fixture 回退,假数据以 200 + 真实结构返回,调用方无法分辨 | 🔴 高 |
| 2 | frontend/src/lib/types.ts | 与 contract 平行的第二套类型,字段已漂移(SellerBrief ≠ Brief) | 🔴 高 |
| 3 | task-15 vs live-api-orchestrator | 同一功能两套实现并存,合并顺序错了会丢测试或丢修复 | 🟡 中 |
| 4 | route.ts mock 分支 | 每次请求同步读盘 mock-result.json,无 schema 校验直接透传 | 🟡 中(删除后自然消失) |
| 5 | dev 分支根目录 app/* | 第二套 UI 与 frontend/ 路由冲突隐患(同仓两个 Next app 入口) | 🟡 中 |
| 6 | check-contract.mjs | 手写校验只查 $ref/type/enum,不查 required 嵌套全集;够用但别误以为是完整校验 | 🟢 低 |

**做得好的**:provider adapter 接缝清晰(去 mock 改动面因此很小)、audit/replay 体系完整、agent 各自带测试、CI 有 contract 校验。

## 4. 风险与代价

- demo 不再零失败:依赖 OpenAI 可用性;Step 2 的 503 + Step 4 的 error UI 是新的兜底语义。
- 前端是最大工程:9 页 × 字段映射 + 加载态,预估远超其他步骤总和。
- `?images=0`(跳过图像生成的快速彩排)建议**保留** —— 它走真实文本管道,不属于 mock。
