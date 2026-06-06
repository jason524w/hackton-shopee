# 任务板 — Sea Launch AI

> 5 条**独立轨**,每轨一个负责人端到端拥有,内部用 subagent 扇出。
> 认领用 GitHub Issues(`gh issue list` → 自分配 → 开分支 → PR)。详规在 `docs/tasks/`。

## 设计原则:按"独占路径"切,不靠细颗粒度防冲突

每条轨**独占一组目录**,两台机器永不改同一文件 → 合并零冲突。`contract/` 只读共享(改要吼)。

## 5 条轨

| Issue | 轨 | 负责人 | 独占路径 | 依赖 | spec |
|---|---|---|---|---|---|
| TASK-01 | 🟥 骨架(blocking) | 最先就绪者 | 根配置 + `app/layout` `lib/openai.ts` | — | [doc](tasks/TASK-01-skeleton.md) |
| TASK-FE | 🎨 前端整轨 | **前端同学(独立)** | `app/{brief,war-room,board,studio}/**` `components/**` | 01 | [doc](tasks/TASK-FE-frontend.md) |
| TASK-BE | 🧠 后端 agent 管道 | P1 | `lib/agents/**` `app/api/run/**` | 01(仅接线) | [doc](tasks/TASK-BE-backend.md) |
| TASK-DATA | 🗃️ 种子数据 | P3 | `seed/**` | 无,**最先可动** | [doc](tasks/TASK-DATA-seed.md) |
| TASK-PITCH | 🎤 Pitch + 兜底 | P4 | `docs/pitch/**` | 无 | [doc](tasks/TASK-PITCH.md) |

## 依赖图

```
TASK-01 骨架(blocking, ~30min, PR 合入即解锁)
   │
   ├─▶ TASK-FE  前端整轨 ── 对着 mock 开发,内部 4 页 subagent 并行,不卡别人
   └─▶ TASK-BE  后端 ── lib/agents 可先写,api/run 接线等骨架
TASK-DATA  种子数据 ── 纯 JSON,立刻开工,无依赖
TASK-PITCH 文案/录屏 ── 立刻可写,后期收口
```

## 关键点
- **前端是完全独立的一轨**:除骨架外只依赖 `contract/mock-result.json`,自己端到端跑通
  demo 主线,不卡别人也不被卡。
- **TASK-DATA / TASK-PITCH 无依赖**,可与骨架同时开工。
- **TASK-BE 的 `lib/agents`** 也能在骨架前就对着 contract 写,只有 `api/run` 接线等骨架。
- 真正的串行卡点只有 **TASK-01**,所以它"先做、快做、直接 push main"。

## 流程
1. `gh issue list` → 领一个 → `gh issue edit <n> --add-assignee @me`
2. `git checkout -b task-<n>-<slug>`
3. 做完 `gh pr create`,标题带任务号,正文写"对哪些 contract 字段/路径负责"
4. **一切走 PR,绝不直接 push main**;CI 绿后自己 merge;main 永远可 demo
