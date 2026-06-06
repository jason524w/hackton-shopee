# Sea Launch AI 🌊🚀

> Sea × OpenAI Codex Hackathon — 电商赛道

面向轻资产卖家的 AI-native 电商运营系统。卖家给一个商品方向,multi-agent 团队在几分钟内
产出一份 **Shopee-ready 的商业判断 + 上架包**:市场 → 货源 → 利润 → 风险 → 上架 → 决策。

> We don't only generate content. We automate the commerce decision before content is generated.

## 文档地图(动手前先读)

| 文档 | 内容 |
|---|---|
| [CLAUDE.md](CLAUDE.md) | **第一份要读的** — 铁律、技术栈、仓库结构、任务领取流程 |
| [docs/MVP-SCOPE.md](docs/MVP-SCOPE.md) | 24h 做什么 / 不做什么 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 系统架构、agent 管道、利润模型 |
| [docs/AGENTS.md](docs/AGENTS.md) | 当前 agent 输入/输出/职责(7-agent 拆分以 roadmap 为准) |
| [docs/IMPLEMENTATION-ROADMAP.md](docs/IMPLEMENTATION-ROADMAP.md) | 7-agent 后端实施路线、目录规范、harness、audit 要求 |
| [docs/TASKS.md](docs/TASKS.md) | 任务板(4 人分工 + 依赖) |
| [contract/README.md](contract/README.md) | 前后端数据契约(已就位) |
| [docs/PRD.md](docs/PRD.md) | 完整产品 PRD(背景资料) |

## 技术栈

Next.js 14 (App Router) · TypeScript · Tailwind · OpenAI Responses API
(Structured Outputs + Function Calling)。

## 状态

🟢 架构文档 + 数据契约就位 · ⬜ 应用骨架待建(见 [TASK-01](docs/TASKS.md))
