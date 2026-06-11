# 异步任务化 + 持久化(Phase 0 / B1)

> 状态:已落地(2026-06-10)。这是生产重构 [PRODUCTION-REFACTOR-PLAN.md](PRODUCTION-REFACTOR-PLAN.md) Phase 0 的第一块。
> 范围:把 run 从「同步 in-request」改为「提交即返回 + 后台执行 + 状态可查」,并把 run 生命周期持久化。

## 为什么

旧路径 `POST /api/run` 在 HTTP 请求里同步串行跑完 7 个 agent(2–4 分钟),靠 `maxDuration=300` 撑着 —— 超时即被杀、客户端只能干等、进程重启就丢。B1 把「提交」和「执行」解耦。

## 新增 API(异步,推荐)

```
POST /api/runs            # 提交,立即 202 返回 { status:"queued", run_id }
GET  /api/runs/:id        # run 状态 + 最终结果:{ status, current_agent?, result?, error? }
GET  /api/runs/:id/audit  # 各 agent 渐进进度(原有,不变)
```

- `POST /api/runs` 校验 brief(共享 `lib/runtime/parse-brief.ts`,与同步端点同一套校验)→ 建 queued 记录 → 入队 → 立即返回 `run_id`。
- 后台 worker 跑 `runOrchestration`,通过 `onAgentStart` 回调把 `current_agent` 写进 run 记录;成功写 `completed`+`result`,失败写 `failed`+`error{kind}`。
- 轮询 `GET /api/runs/:id` 看状态/结果,`GET /api/runs/:id/audit` 看逐 agent 细节。
- query 同同步端点:`?images=0|false|no` 跳过图像生成;body `run_id`(`run_*` 格式)可自带,重复则 409。

> 同步端点 `POST /api/run` 保留(向后兼容,可 curl)。**前端已迁移到异步**:`startRun` 改为 `submitRun` + 轮询 `GET /api/runs/:id`,run id 持久化到 localStorage,刷新后 `resumeActiveRun()`(在 `app/app/layout.tsx` 挂载时调用)重新挂接在跑的 run。

## 架构接缝(可换 Postgres / Redis)

两个小接口,默认实现零新依赖、单机够用,扩容时直接替换实现、不动调用方:

| 接口 | 默认实现 | 扩容替换 |
|------|----------|----------|
| `RunStore`(`lib/runtime/run-store.ts`) | `FilesystemRunStore` — `<audit_root>/<run_id>/run.json`,原子写(temp+rename)、进程内 per-run 串行化 | Postgres `runs` 表 |
| `JobQueue`(`lib/runtime/job-queue.ts`) | `InProcessJobQueue` — 进程内有界并发 worker | Redis / BullMQ |

`RunsService`(`lib/runtime/runs-service.ts`)把两者粘起来:`submitRun` / `getRun` / `resumeIncompleteRuns` / `drain`。`getRunsService()` 是进程级单例(供 API 路由共享)。

## 持久化与恢复

- run 记录落 `run.json`(queued→running→completed/failed,带 `current_agent`、`started_at`、`finished_at`、`result`/`error`)。
- 重启后调 `resumeIncompleteRuns()` 把残留的 queued/running 重新入队(`runJob` 对已终态幂等跳过)。

## 配置

- `RUN_CONCURRENCY`(默认 2):最大并发 run 数。每个 run 驱动整条 LLM+采集管道,别设太大。

## 已知边界 / 下一步

- **进程内队列需要常驻进程**:本仓库目标部署是自管 Docker `next start`(进程常驻),适用。若回 Vercel 等按请求冻结的平台,需换 Redis 实现(接口已就位)。
- **对象存储(MinIO/S3)**:截图/生成图仍写文件系统;迁对象存储是 Phase 0 的 B2。
- **Postgres 替换**:`RunStore` 接口已为此设计,多实例时落地。
- **前端异步迁移**:✅ 已完成 —— 前端走 `POST /api/runs` + 轮询 `GET /api/runs/:id`,localStorage 持久化 run id + 刷新恢复(`resumeActiveRun`)。
- **服务端启动自动 resume**:✅ 已完成 —— `getRunsService()` 首次构建单例时(即重启后首个请求)触发 `resumeRunsOnBoot`(`lib/runtime/boot.ts`),把残留 queued/running 重新入队。幂等、不抛错;无 `OPENAI_API_KEY` 时跳过(记录留 queued 等配好 key 的下次启动)。<br>(放在单例懒构建而非 Next instrumentation,是因为 Next 14 的 instrumentation 会被 edge 打包、`node:fs/crypto` 报 UnhandledScheme;单例路径只在 Node 服务运行时被 API 路由 import,无此问题。)
