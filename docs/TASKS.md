# 任务板 — Sea Launch AI(权威)

> 后端选了**完整 ROADMAP**。任务 = 前端 1 轨 + 数据 1 轨 + pitch 1 轨 + 后端 9 个并行 PR + 骨架。
> 认领用 GitHub Issues。每个任务**独占一组路径**,多机/多 agent 并行不冲突。
> 后端细节权威:[IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md);Committee:[COMMITTEE.md](COMMITTEE.md)。

## ✅ 已完成(bootstrap)
- **契约 Phase 0**:contract 升到 **7-agent**(+ packaging)+ `audit_run_id`,`check-contract` 通过。
- 文档冲突已消解:demo 路径(live 主 + mock 安全网)、COMMITTEE/AGENTS 对齐 7-agent。

## 依赖与并行

```
TASK-01 骨架(blocking)── scaffold lib/ 全部目录 + api 占位 + audit stub
   │
   ├─▶ 前端轨  TASK-FE          ── 对 mock 渲染 7 agent,独立,不卡别人
   ├─▶ 后端 ┌ TASK-RUNTIME-AUDIT ┐
   │        └ TASK-PROVIDERS ────┘→ TASK-MARGIN-RISK / MARKET-SOURCING / LISTING / PACKAGING
   │                                    └──────────────┬───────────────┘
   │                                          TASK-COMMITTEE → TASK-API-INTEGRATION → TASK-HARNESS-QA
TASK-DATA  种子数据 ── 纯 JSON,无依赖,最先开工(给 providers 当 fixture)
TASK-PITCH 文案/录屏 ── 无依赖
```

## 轨与独占路径

| Issue | 轨 | 独占路径 | 依赖 | 文档 |
|---|---|---|---|---|
| TASK-01 | 🟥 骨架 | 根配置 + `app/**`(占位)+ `lib/**`(空目录) | — | [spec](tasks/TASK-01-skeleton.md) |
| TASK-FE | 🎨 前端 | `app/{brief,war-room,board,studio}/**` `components/**` | 01 | [spec](tasks/TASK-FE-frontend.md) |
| TASK-DATA | 🗃️ 数据 | `seed/**` | 无 | [spec](tasks/TASK-DATA-seed.md) |
| TASK-PITCH | 🎤 pitch | `docs/pitch/**` | 无 | [spec](tasks/TASK-PITCH.md) |
| TASK-RUNTIME-AUDIT | 🧠 后端 | `lib/agent-runtime/**` | 01 | [ROADMAP §5/§10](IMPLEMENTATION-ROADMAP.md) |
| TASK-PROVIDERS | 🧠 后端 | `lib/providers/{shopee,sourcing-1688,shipping,fx}/**` | 01 + DATA | [ROADMAP §6](IMPLEMENTATION-ROADMAP.md) |
| TASK-MARGIN-RISK | 🧠 后端 | `lib/agents/margin/**` `lib/agents/risk/**` | runtime+providers | [ROADMAP §7/§8.3/§8.4](IMPLEMENTATION-ROADMAP.md) |
| TASK-MARKET-SOURCING | 🧠 后端 | `lib/agents/market/**` `lib/agents/sourcing/**` | runtime+providers | [ROADMAP §8.1/§8.2](IMPLEMENTATION-ROADMAP.md) |
| TASK-LISTING | 🧠 后端 | `lib/agents/listing/**` | runtime+risk | [ROADMAP §8.5](IMPLEMENTATION-ROADMAP.md) |
| TASK-PACKAGING-IMAGE | 🧠 后端 | `lib/agents/packaging/**` `lib/providers/openai-image/**` | runtime+risk | [ROADMAP §8.6](IMPLEMENTATION-ROADMAP.md) |
| TASK-COMMITTEE | 🧠 后端 | `lib/agents/committee/**` | margin/risk/listing | [COMMITTEE.md](COMMITTEE.md) |
| TASK-API-INTEGRATION | 🧠 后端 | `app/api/run/**` `app/api/runs/[id]/audit/**` | 上述全部 | [ROADMAP §9](IMPLEMENTATION-ROADMAP.md) |
| TASK-HARNESS-QA | 🧠 后端 | `tests/**` | 各 agent | [ROADMAP §11](IMPLEMENTATION-ROADMAP.md) |

## 建议起步顺序
1. **TASK-01 骨架**先做、PR 合入即解锁(它把 `lib/` 所有空目录建好,后端 9 个 PR 才不撞车)。
2. 与骨架并行:**TASK-DATA**(给 providers 当 fixture)、**TASK-PITCH**、**TASK-FE**(对 mock 开发)。
3. 骨架后:**TASK-RUNTIME-AUDIT + TASK-PROVIDERS** 先行,它们是其余 agent 的地基。
4. 然后 agent 们并行:margin-risk / market-sourcing / listing / packaging。
5. 收口:committee → api-integration → harness-qa。

## 流程(见 [CONTRIBUTING.md](../CONTRIBUTING.md))
- `gh issue list` → `gh issue edit <n> --add-assignee @me` → `git checkout -b task-<slug>` → PR(CI 绿自己 merge)。
- 一切走 PR,不直接 push main;只改自己独占路径;动 `contract/` 先吼 + 跑 `check-contract`。
