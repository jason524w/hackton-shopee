# 下一步实施方案 — 对齐文档目标态

> 基于 main@3df8074 通读全部 docs 后的差距分析与可执行计划(2026-06-07)。
> **执行进度:GAP-1 ✅(#53) · GAP-4/5/6 ✅(#54) · GAP-8 ✅(#55) · GAP-2 ✅ · GAP-3 ✅(见 DEMO-READINESS.md)
> · GAP-7 代码侧 ✅(maxDuration),部署本体待 Vercel Pro 决策。**
> 配套阅读:IMPLEMENTATION-ROADMAP(后端权威)、design/committee.md(#14 权威)、REFACTOR.md(已执行)。

## 0. 现状基线(先纠正一个普遍误解)

REFACTOR.md 描述的去 mock 重构**已全部执行完毕**(PR #51/#52 已合 main):
`/api/run` 单一 live 路径、前端真实接入 `/api/run`、mock 资产清除、5 个 live bug 修复。
**live 端到端已实测通过**:`POST /api/run?images=0` → HTTP 200(201s),7 agent 全 done,
吸尘器 primary=Watch、risk_level=medium、human_review=true、tradeoffs×3 —— demo 高潮成立。

因此文档承诺中 Phase 0–8 已达成;**剩余差距集中在以下 8 项**。

## 1. 差距清单与解决方案

### P0 — demo 体验链路(文档明确承诺、当前缺失)

**GAP-1 · War Room「渐进点亮」**(MVP-SCOPE/TASKS-FE/contract README 均承诺 "status 渐进点亮 + evidence")
现状:管道一次 POST 跑 200s,前端整体显示 running,结束后 7 个卡同时点亮。
方案(利用现成 audit 体系,后端改动极小):
1. `POST /api/run` 接受客户端预生成的 run id(body `{run_id}`,过 `isSafeAuditRunId` 校验),
   audit sink 用它写 `.runs/<id>/agents/*.json` —— FileAuditSink 在每个 agent 完成时已落盘。
2. 前端 `startRun()`:先生成 `run_<uuid>`,发起 POST 后**每 3s 轮询 `GET /api/runs/:id/audit`**,
   把返回的 agent snapshots 映射成 department status(completed→complete,其余 running/waiting),
   evidence/score 同步点亮;POST 返回后用最终 RunResult 覆盖。
3. 复用现有 `adapters.ts`,新增 `toDepartmentsFromAudit(snapshots)`。
工作量:后端 ~1h,前端 ~3-4h。验收:org-room 页能看到 7 个部门按真实完成顺序逐个点亮。

**GAP-2 · 全量 live(含图像生成)从未验证**(ROADMAP §15 DoD:"live image 生成或优雅降级")
现状:只验证过 `?images=0`;`imageMode:"live"` 路径(openai-image provider、public/generated 落盘)零实测。
方案:跑一次不带参数的 `POST /api/run`,核对 ① 三张图落 `public/generated/` ② `images[].url` 可访问
③ 失败时 packaging 走 needs_review 降级而非炸管道。修暴露的 bug(预期与上次 5 连修同性质)。
工作量:0.5-1d(取决于暴露多少 bug)。

**GAP-3 · Phase 9 Demo Hardening 整体未做**(ROADMAP §12 Phase 9 + §15)
方案(流程项,逐条照做):
1. 连跑 5 次 `?images=0` + 2 次全量,记录成功率与耗时分布;
2. 捕获并保存 1 份成功 audit + 1 份降级 audit(committee fallback 触发那种);
3. 录屏完整 happy path 当网络兜底;4. 彩排计时 ≤3 分钟。
工作量:0.5d,放在 GAP-1/2 之后做。

### P1 — 文档验收承诺补强

**GAP-4 · committee LLM 失败兜底无测试**(design/committee.md §4/§7 验收锚点)
方案:vitest 注入 fake client(超时 / 输出缺 ranked_ids / 非法 verdict 三个 case),断言:
fallback 决策=确定性 baseDecision+gates(吸尘器=Watch)、降级信号三处可见
(warnings 前缀 ⚠、summary 前缀、decision_reason 模板)。接缝(`RunAgentOptions.client`)已存在。
工作量:3-4h。

**GAP-5 · risk 红线输出不完整**(design/margin-risk.md §4.3:吸尘器 risk warnings 必含
「避免夸大吸力」+「USB/电器安全需复核」两条)
现状(live 实测):`risk.warnings` 只有利润敏感一条;夸大吸力约束落在了
`selected_listing.compliance.warnings`,「电器安全」字样缺失。
方案:检查 `lib/agents/risk/aggregate.ts` 的 checkpoint→AgentResult 映射,把 listing/packaging
checkpoint 产生的 claims/电器类目 warning 聚合进 `agents[risk].warnings`;
确定性规则(claims.ts 黑名单 + 电器类目)补「USB/电器安全需人工复核」条目;加回归测试钉死。
工作量:2-3h。

**GAP-6 · seed detail 覆盖 1/10**(TASK-DATA 承诺 seed 完整)
现状:search 暴露 10 个 item,detail 只录了 001;现在靠工具优雅降级。
方案:采用"summary-backed detail"——detail 未命中时由 search 条目合成降级 detail
(标 `evidence_label: "search-derived"`),模型拿到结构化数据而非道歉文案。
(桌面副本曾有同思路实现,已丢弃,按此思路在 `lib/providers/shopee/index.ts` 重写 ~40 行。)
工作量:1-2h。

**GAP-7 · Vercel 部署未验证**(CLAUDE.md 技术栈承诺 "Vercel 部署")
⚠ 关键约束:管道实测 201s,**Vercel Hobby 函数上限 60s,必超时**。三选一:
- a) Vercel Pro + route 配置 `export const maxDuration = 300`(最省事,推荐);
- b) 配合 GAP-1 的轮询架构改成"逐 agent 调用"(每个 agent 一个 ≤60s 请求,客户端驱动)——工程大,不建议 MVP 做;
- c) demo 当天本地跑,部署只放营销页(零成本兜底)。
另:双 Next app(根 app=API、frontend/=新 UI)需要拆成两个 Vercel project,
frontend 设 `NEXT_PUBLIC_API_BASE_URL` 指向 API 域名(代码已支持)。
audit 存储 `resolveAuditRoot` 已 serverless-safe(写 /tmp),但 **/tmp 不跨实例**——
GAP-1 的轮询在 Vercel 上需要把 AuditSink 换成 KV/Upstash(加一个 `KvAuditSink`,接口已抽象)。
工作量:a 路线 0.5d(含 KV sink 1d)。

**GAP-8 · 文档自身维护**
- REFACTOR.md 顶部状态改为「已执行(PR #51/#52),保留作决策记录」;
- 评审并处理最后一个遗留分支 `codex/docs-three-main-docs`(TASKS.md 大重写,合并或关闭);
- TASKS.md 把 TASK-API-INTEGRATION / TASK-FE 标记为完成,新增本文件的 GAP 任务并开 GitHub Issues。
工作量:1-2h。

### P2 — 文档明确延后项(进 roadmap,不阻塞 demo)

| 项 | 出处 | 建议 |
|---|---|---|
| Pickup 断电恢复(audit replay 续跑) | design/committee.md §5、ROADMAP §10 | replay.ts 骨架已在,等 demo 后做 |
| 「高风险不能 Go」软约束 eval | design/committee.md §7(pure-A 的代价) | 写 10 组对抗 fixture 离线跑,监测 LLM 越线率 |
| market Web Search 热度兜底 | ARCHITECTURE/AGENTS | 可选,seed 足够 demo |
| 1688 live 数据源(Oxylabs Scraper API) | 前期调研结论 | 免费 2000 条验证解析质量后,新增 provider 实现同接口 |
| Lazada / 多地区 / ROI Dashboard | MVP-SCOPE ❌ 表 | 保持只讲不做 |

## 2. 执行顺序与工作量汇总

```
第 1 天   GAP-1 渐进点亮(后端 run_id + 前端轮询)──→ GAP-2 全量 live 验证
第 2 天   GAP-3 彩排×5 + 录屏        GAP-4 兜底测试 ∥ GAP-5 risk 红线 ∥ GAP-6 seed 降级(可并行领)
第 3 天   GAP-7 Vercel(Pro + maxDuration + KV audit) + GAP-8 文档收尾
```

| 优先级 | 项 | 预估 |
|---|---|---|
| P0 | GAP-1 渐进点亮 | 0.5-1d |
| P0 | GAP-2 全量 live 验证 | 0.5-1d |
| P0 | GAP-3 demo hardening | 0.5d |
| P1 | GAP-4/5/6 | 各 2-4h,可并行 |
| P1 | GAP-7 部署 | 0.5-1.5d(视是否做 KV) |
| P1 | GAP-8 文档 | 1-2h |

全部走 PR(铁律:不直接 push main),每个 GAP 一个 Issue + 分支,PR 注明 `Closes #N`。
