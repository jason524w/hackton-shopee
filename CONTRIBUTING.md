# 工程规则(hackathon · 越简单越好)

> 4 人 / 多 agent / 24h。规则只为"多人并行不打架、main 永远能 demo",其余从简。

## 分支与合并
- **一切走 PR,不直接 push main。**(含 TASK-01 骨架,只是可不等 review)
  > private 免费库服务端无法硬挡 → 这是**团队约定**,PR 上的 CI 红绿是安全网。请自觉遵守。
- 分支名:`task-<n>-<slug>`,例:`task-2-war-room`。
- **一个 task/track 一个 PR**,尽量小、尽量快。
- **不强制 review**(等审会死锁):**PR + CI 绿 → 自己 merge**;鼓励队友顺手扫一眼。
- merge 后删分支。

## Commit
- 信息前缀 `TASK-<n>:`,例:`TASK-3: opportunity board profit card`。

## 路径所有权(防冲突的核心)
- **只改你那条轨的独占路径**(见 [docs/TASKS.md](docs/TASKS.md))。两台机器永不碰同一文件。
- `components/ui/` 等公共件:谁先建谁占,其余人只读,要改先吼。
- **`contract/` 是只读共享**:要改先在群里吼,改完跑 `node scripts/check-contract.mjs`。

## 不破坏 main
- main 永远 **P0 可 demo**(`/api/run?mock=1` + 前端主线跑得通)。
- PR 别合进跑不起来 / 报错的东西。

## CI
- 每个 PR 自动跑 `scripts/check-contract.mjs`(契约校验,零依赖)。**红了不要 merge。**

## 安全
- `.env.local` / API key **不入库**(已在 `.gitignore`)。

## 卡住了
- 5 分钟解决不了的 blocker,直接群里 @ 人,别闷头扛。

## Definition of Done
- 对应 issue 的**验收标准达成**;若动了 `contract/`,`check-contract` 通过。

---
完整背景与铁律见 [CLAUDE.md](CLAUDE.md);任务板见 [docs/TASKS.md](docs/TASKS.md)。
